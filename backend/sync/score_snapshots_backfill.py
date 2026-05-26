from collections import defaultdict
from datetime import timedelta
import time

import requests
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import CampusUser, CampusUserScoreSnapshot, Coalition, CoalitionScoreSnapshot
from .services import _build_sync_context, _http_get, _request_42_token, get_request_count, reset_request_count
from .season import (
	CURRENT_SEASON_END_DATE,
	CURRENT_SEASON_INITIAL_COALITION_BONUS,
	CURRENT_SEASON_START_DATE,
	CURRENT_SEASON_START_DT,
)


def _daterange(start_date, end_date):
	current = start_date
	while current <= end_date:
		yield current
		current += timedelta(days=1)


def _request_coalition_scores_page(coalition_id, ctx, page=1, per_page=100, request_interval=0.25):
	time.sleep(max(request_interval, 0))
	last_exc = None
	response = None

	for attempt in range(5):
		try:
			response = _http_get(
				f"{ctx['base_url']}/v2/coalitions/{coalition_id}/scores",
				headers=ctx['headers'],
				params={
					'page': page,
					'per_page': per_page,
					'sort': '-created_at',
				},
				timeout=20,
			)
			if response.status_code == 401:
				ctx['headers'] = {'Authorization': f'Bearer {_request_42_token()}'}
				continue
			if response.status_code == 429 or 500 <= response.status_code < 600:
				retry_after = response.headers.get('Retry-After')
				delay = float(retry_after) if retry_after else min(2 ** attempt, 16)
				time.sleep(delay)
				continue
			break
		except requests.RequestException as exc:
			last_exc = exc
			time.sleep(min(2 ** attempt, 16))

	if response is None:
		raise last_exc

	response.raise_for_status()
	return response


def _is_within_backfill_window(created_at, start_date, end_date):
	if created_at is None:
		return False

	event_date = timezone.localdate(created_at)
	if event_date < start_date or event_date > end_date:
		return False

	if event_date == CURRENT_SEASON_START_DATE and created_at < CURRENT_SEASON_START_DT:
		return False

	return True


def _collect_coalition_score_events(coalition, ctx, start_date, end_date, request_interval=0.25):
	rows = []
	page = 1
	start_boundary = start_date

	while True:
		page_rows = _request_coalition_scores_page(
			coalition_id=coalition.coalition_id,
			ctx=ctx,
			page=page,
			request_interval=request_interval,
		).json()

		if not page_rows:
			break

		should_stop = False
		for row in page_rows:
			created_at = parse_datetime(row.get('created_at'))
			if created_at is None:
				continue

			event_date = timezone.localdate(created_at)
			if event_date < start_boundary:
				should_stop = True
				break
			if event_date == CURRENT_SEASON_START_DATE and created_at < CURRENT_SEASON_START_DT:
				continue
			if not _is_within_backfill_window(created_at, start_date, end_date):
				continue

			rows.append(row)

		if should_stop:
			break

		page += 1

	return list(reversed(rows))


def _accumulate_daily_scores(score_rows, start_date, end_date):
	coalition_daily_deltas = defaultdict(lambda: defaultdict(int))
	user_daily_deltas = defaultdict(lambda: defaultdict(int))

	for row in score_rows:
		created_at = parse_datetime(row.get('created_at'))
		if not _is_within_backfill_window(created_at, start_date, end_date):
			continue

		event_date = timezone.localdate(created_at)
		coalition_id = row.get('coalition_id')
		coalitions_user_id = row.get('coalitions_user_id')
		value = int(row.get('value') or 0)

		if coalition_id is not None:
			coalition_daily_deltas[coalition_id][event_date] += value
		if coalitions_user_id is not None:
			user_daily_deltas[coalitions_user_id][event_date] += value

	return coalition_daily_deltas, user_daily_deltas


def _build_daily_totals(tracked_ids, daily_deltas, start_date, end_date):
	daily_totals = {}
	running = {tracked_id: 0 for tracked_id in tracked_ids}

	for snapshot_date in _daterange(start_date, end_date):
		for tracked_id in tracked_ids:
			running[tracked_id] += daily_deltas.get(tracked_id, {}).get(snapshot_date, 0)
			daily_totals[(tracked_id, snapshot_date)] = running[tracked_id]

	return daily_totals


def _apply_initial_coalition_bonus(coalitions, coalition_daily_totals, start_date, end_date):
	if start_date > CURRENT_SEASON_START_DATE or end_date < CURRENT_SEASON_START_DATE:
		return coalition_daily_totals

	for coalition in coalitions:
		bonus = CURRENT_SEASON_INITIAL_COALITION_BONUS.get((coalition.slug or '').lower(), 0)
		if bonus == 0:
			continue

		for snapshot_date in _daterange(max(start_date, CURRENT_SEASON_START_DATE), end_date):
			coalition_daily_totals[(coalition.coalition_id, snapshot_date)] += bonus

	return coalition_daily_totals


def _rank_users_for_day(day_scores, coalition_id_by_user_id, intra_id_by_user_id):
	global_order = sorted(
		day_scores.items(),
		key=lambda item: (-item[1], intra_id_by_user_id[item[0]]),
	)
	global_ranks = {user_id: index for index, (user_id, _score) in enumerate(global_order, start=1)}

	coalition_groups = defaultdict(list)
	for user_id, score in day_scores.items():
		coalition_groups[coalition_id_by_user_id[user_id]].append((user_id, score))

	coalition_ranks = {}
	for coalition_id, members in coalition_groups.items():
		ordered_members = sorted(
			members,
			key=lambda item: (-item[1], intra_id_by_user_id[item[0]]),
		)
		for index, (user_id, _score) in enumerate(ordered_members, start=1):
			coalition_ranks[user_id] = index

	return global_ranks, coalition_ranks


def _build_coalition_snapshot_rows(coalitions, coalition_daily_totals, start_date, end_date):
	snapshot_rows = []

	for snapshot_date in _daterange(start_date, end_date):
		day_scores = {
			coalition.id: coalition_daily_totals[(coalition.coalition_id, snapshot_date)]
			for coalition in coalitions
		}
		ranked = sorted(
			day_scores.items(),
			key=lambda item: (-item[1], next(coalition.name for coalition in coalitions if coalition.id == item[0])),
		)
		ranks = {coalition_pk: index for index, (coalition_pk, _score) in enumerate(ranked, start=1)}

		for coalition in coalitions:
			snapshot_rows.append(
				CoalitionScoreSnapshot(
					coalition=coalition,
					snapshot_date=snapshot_date,
					total_score=day_scores[coalition.id],
					campus_rank=ranks[coalition.id],
				)
			)

	return snapshot_rows


def _build_user_snapshot_rows(users, user_daily_totals, start_date, end_date):
	users_by_coalitions_user_id = {user.coalitions_user_id: user for user in users}
	coalition_id_by_user_id = {user.id: user.coalition_id for user in users}
	intra_id_by_user_id = {user.id: user.intra_id for user in users}
	tracked_keys = list(users_by_coalitions_user_id.keys())
	snapshot_rows = []

	for snapshot_date in _daterange(start_date, end_date):
		day_scores = {
			users_by_coalitions_user_id[coalitions_user_id].id: user_daily_totals[(coalitions_user_id, snapshot_date)]
			for coalitions_user_id in tracked_keys
		}
		global_ranks, coalition_ranks = _rank_users_for_day(day_scores, coalition_id_by_user_id, intra_id_by_user_id)

		for coalitions_user_id, user in users_by_coalitions_user_id.items():
			snapshot_rows.append(
				CampusUserScoreSnapshot(
					campus_user=user,
					snapshot_date=snapshot_date,
					coalition_user_score=day_scores[user.id],
					coalition_user_rank=coalition_ranks[user.id],
					campus_user_rank=global_ranks[user.id],
				)
			)

	return snapshot_rows


def _upsert_snapshots(model, rows, fields, unique_fields, batch_size=2000):
	if not rows:
		return 0

	model.objects.bulk_create(
		rows,
		batch_size=batch_size,
		update_conflicts=True,
		update_fields=fields,
		unique_fields=unique_fields,
	)
	return len(rows)


def backfill_daily_score_snapshots(
	start_date=CURRENT_SEASON_START_DATE,
	end_date=None,
	coalition_queryset=None,
	request_interval=0.25,
):
	if end_date is None:
		end_date = min(timezone.localdate(), CURRENT_SEASON_END_DATE)

	if start_date > end_date:
		raise ValueError('start_date must be before or equal to end_date')

	reset_request_count()
	ctx = _build_sync_context()
	coalitions = list((coalition_queryset or Coalition.objects.order_by('coalition_id')).only('id', 'coalition_id', 'name'))
	users = list(
		CampusUser.objects.filter(
			is_active=True,
			coalitions_user_id__isnull=False,
			coalition_id__isnull=False,
		).exclude(coalitions_user_id=0).only('id', 'intra_id', 'coalitions_user_id', 'coalition_id')
	)

	all_score_rows = []
	for coalition in coalitions:
		all_score_rows.extend(
			_collect_coalition_score_events(
				coalition=coalition,
				ctx=ctx,
				start_date=start_date,
				end_date=end_date,
				request_interval=request_interval,
			)
		)

	coalition_daily_deltas, user_daily_deltas = _accumulate_daily_scores(all_score_rows, start_date, end_date)
	coalition_daily_totals = _build_daily_totals(
		tracked_ids=[coalition.coalition_id for coalition in coalitions],
		daily_deltas=coalition_daily_deltas,
		start_date=start_date,
		end_date=end_date,
	)
	coalition_daily_totals = _apply_initial_coalition_bonus(
		coalitions=coalitions,
		coalition_daily_totals=coalition_daily_totals,
		start_date=start_date,
		end_date=end_date,
	)
	user_daily_totals = _build_daily_totals(
		tracked_ids=[user.coalitions_user_id for user in users],
		daily_deltas=user_daily_deltas,
		start_date=start_date,
		end_date=end_date,
	)

	coalition_rows = _build_coalition_snapshot_rows(coalitions, coalition_daily_totals, start_date, end_date)
	user_rows = _build_user_snapshot_rows(users, user_daily_totals, start_date, end_date)

	coalition_count = _upsert_snapshots(
		model=CoalitionScoreSnapshot,
		rows=coalition_rows,
		fields=['total_score', 'campus_rank'],
		unique_fields=['coalition', 'snapshot_date'],
	)
	user_count = _upsert_snapshots(
		model=CampusUserScoreSnapshot,
		rows=user_rows,
		fields=['coalition_user_score', 'coalition_user_rank', 'campus_user_rank'],
		unique_fields=['campus_user', 'snapshot_date'],
	)

	return {
		'start_date': start_date,
		'end_date': end_date,
		'processed_coalitions': len(coalitions),
		'processed_users': len(users),
		'fetched_score_rows': len(all_score_rows),
		'coalition_snapshots_upserted': coalition_count,
		'user_snapshots_upserted': user_count,
		'request_count': get_request_count(),
	}
