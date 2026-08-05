from datetime import timezone as datetime_timezone
import logging
import time

import requests
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import CampusUser, Coalition, CoalitionProjectCursor
from .services import _build_sync_context, _http_get, _request_42_token

logger = logging.getLogger(__name__)


CURRENT_SEASON_START = '2026-04-08T15:42:00Z'
CURRENT_SEASON_END = '2026-10-08T10:00:00Z'
CURRENT_SEASON_START_DT = parse_datetime(CURRENT_SEASON_START)
CURRENT_SEASON_END_DT = parse_datetime(CURRENT_SEASON_END)
PROJECT_SCORE_REASON = 'You validated a project. Congratulations!'
PROJECT_SCOREABLE_TYPE = 'ProjectsUser'


def _ensure_aware_datetime(value):
	if timezone.is_naive(value):
		return timezone.make_aware(value, datetime_timezone.utc)
	return value


def _is_missing_42_user_http_error(exc):
	response = getattr(exc, 'response', None)
	return response is not None and response.status_code == 404


def _is_newer_than_user_sync(event_at, synced_at):
	if event_at is None or synced_at is None:
		return True
	return _ensure_aware_datetime(event_at) > _ensure_aware_datetime(synced_at)


def _request_projects_page(login, ctx, page=1, per_page=100, request_interval=0.6, extra_params=None):
	params = {
		'page': page,
		'per_page': per_page,
		'filter[status]': 'finished',
	}
	if extra_params:
		params.update(extra_params)

	time.sleep(max(request_interval, 0))
	last_exc = None
	response = None

	for attempt in range(5):
		try:
			response = _http_get(
				f"{ctx['base_url']}/v2/users/{login}/projects_users",
				headers=ctx['headers'],
				params=params,
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


def _is_delivered_project(project_user, cursus_id):
	cursus_ids = project_user.get('cursus_ids') or []
	cursus_ids = {str(value) for value in cursus_ids}
	return project_user.get('validated?') is True and str(cursus_id) in cursus_ids


def _count_delivered_project_rows(rows, cursus_id):
	return sum(1 for row in rows if _is_delivered_project(row, cursus_id))


def _fetch_projects_count(login, ctx=None, request_interval=0.6, extra_params=None):
	ctx = ctx or _build_sync_context()
	first_response = _request_projects_page(
		login=login,
		ctx=ctx,
		page=1,
		request_interval=request_interval,
		extra_params=extra_params,
	)
	first_page_rows = first_response.json()
	count = _count_delivered_project_rows(first_page_rows, ctx['cursus_id'])
	total = int(first_response.headers.get('x-total', 0))
	per_page = int(first_response.headers.get('x-per-page', 100))
	total_pages = (total + per_page - 1) // per_page if total and per_page else 1

	for page in range(2, total_pages + 1):
		response = _request_projects_page(
			login=login,
			ctx=ctx,
			page=page,
			request_interval=request_interval,
			extra_params=extra_params,
		)
		count += _count_delivered_project_rows(response.json(), ctx['cursus_id'])

	return count


def fetch_user_projects_delivered_total(login, ctx=None, request_interval=0.6):
	return _fetch_projects_count(
		login=login,
		ctx=ctx,
		request_interval=request_interval,
	)


def fetch_user_projects_delivered_current_season(login, ctx=None, request_interval=0.6):
	return _fetch_projects_count(
		login=login,
		ctx=ctx,
		request_interval=request_interval,
		extra_params={
			'range[marked_at]': f'{CURRENT_SEASON_START},{CURRENT_SEASON_END}',
		},
	)


def sync_users_projects_delivered(queryset=None, request_interval=0.6):
	users = queryset if queryset is not None else CampusUser.objects.exclude(login='').order_by('id')
	ctx = _build_sync_context()
	processed = 0
	updated = 0
	skipped_missing = 0

	for user in users:
		processed += 1
		try:
			total = fetch_user_projects_delivered_total(user.login, ctx=ctx, request_interval=request_interval)
			current_season = fetch_user_projects_delivered_current_season(
				user.login,
				ctx=ctx,
				request_interval=request_interval,
			)
		except requests.HTTPError as exc:
			if not _is_missing_42_user_http_error(exc):
				raise
			skipped_missing += 1
			logger.warning(
				'Skipping projects sync for login=%s intra_id=%s because 42 returned 404.',
				user.login,
				user.intra_id,
			)
			continue

		fields_to_update = []
		if user.projects_delivered_total != total:
			user.projects_delivered_total = total
			fields_to_update.append('projects_delivered_total')
		if user.projects_delivered_current_season != current_season:
			user.projects_delivered_current_season = current_season
			fields_to_update.append('projects_delivered_current_season')
		user.projects_delivered_synced_at = timezone.now()
		fields_to_update.append('projects_delivered_synced_at')

		user.save(update_fields=fields_to_update)
		if len(fields_to_update) > 1:
			updated += 1

	return {
		'processed': processed,
		'updated': updated,
		'skipped_missing': skipped_missing,
	}


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


def _fetch_project_user(project_user_id, ctx, request_interval=0.25):
	time.sleep(max(request_interval, 0))
	last_exc = None
	response = None

	for attempt in range(5):
		try:
			response = _http_get(
				f"{ctx['base_url']}/v2/projects_users/{project_user_id}",
				headers=ctx['headers'],
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
	return response.json()


def _is_project_score_event(score_event):
	return (
		score_event.get('reason') == PROJECT_SCORE_REASON
		and score_event.get('scoreable_type') == PROJECT_SCOREABLE_TYPE
		and score_event.get('scoreable_id') is not None
	)


def _collect_new_coalition_project_scores(coalition, cursor, ctx, request_interval=0.25):
	first_page = _request_coalition_scores_page(
		coalition_id=coalition.coalition_id,
		ctx=ctx,
		page=1,
		request_interval=request_interval,
	)
	first_page_rows = first_page.json()

	if not first_page_rows:
		return {
			'bootstrapped': False,
			'new_rows': [],
			'newest_score_id': None,
			'newest_created_at': None,
		}

	newest_row = first_page_rows[0]
	newest_score_id = newest_row.get('id')
	newest_created_at = parse_datetime(newest_row.get('created_at'))

	if cursor.last_score_id is None:
		return {
			'bootstrapped': True,
			'new_rows': [],
			'newest_score_id': newest_score_id,
			'newest_created_at': newest_created_at,
		}

	new_rows = []
	page = 1

	while True:
		page_rows = first_page_rows if page == 1 else _request_coalition_scores_page(
			coalition_id=coalition.coalition_id,
			ctx=ctx,
			page=page,
			request_interval=request_interval,
		).json()

		if not page_rows:
			break

		stop = False
		for row in page_rows:
			if row.get('id') == cursor.last_score_id:
				stop = True
				break
			new_rows.append(row)

		if stop:
			break

		page += 1

	return {
		'bootstrapped': False,
		'new_rows': new_rows,
		'newest_score_id': newest_score_id,
		'newest_created_at': newest_created_at,
	}


def _apply_project_score_rows(score_rows, ctx, request_interval=0.25):
	events_by_intra_id = {}
	seen_project_user_ids = set()
	project_rows = 0

	for row in score_rows:
		if not _is_project_score_event(row):
			continue

		project_user_id = row.get('scoreable_id')
		if project_user_id in seen_project_user_ids:
			continue
		seen_project_user_ids.add(project_user_id)

		project_user = _fetch_project_user(project_user_id, ctx=ctx, request_interval=request_interval)
		if not _is_delivered_project(project_user, ctx['cursus_id']):
			continue

		user_payload = project_user.get('user') or {}
		intra_id = user_payload.get('id')
		if intra_id is None:
			continue

		marked_at = parse_datetime(project_user.get('marked_at') or row.get('created_at'))
		events_by_intra_id.setdefault(intra_id, []).append(marked_at)
		project_rows += 1

	if not events_by_intra_id:
		return {
			'scanned_rows': len(score_rows),
			'project_rows': project_rows,
			'updated_users': 0,
		}

	users = list(CampusUser.objects.filter(intra_id__in=events_by_intra_id.keys()))
	users_by_intra_id = {user.intra_id: user for user in users}
	now = timezone.now()
	users_to_update = []

	for intra_id, event_times in events_by_intra_id.items():
		user = users_by_intra_id.get(intra_id)
		if user is None:
			continue

		total_increment = 0
		season_increment = 0
		for event_at in event_times:
			if not _is_newer_than_user_sync(event_at, user.projects_delivered_synced_at):
				continue
			total_increment += 1
			if event_at and CURRENT_SEASON_START_DT <= event_at <= CURRENT_SEASON_END_DT:
				season_increment += 1

		if total_increment == 0:
			continue

		user.projects_delivered_total += total_increment
		user.projects_delivered_current_season += season_increment
		user.projects_delivered_synced_at = now
		users_to_update.append(user)

	if users_to_update:
		CampusUser.objects.bulk_update(
			users_to_update,
			['projects_delivered_total', 'projects_delivered_current_season', 'projects_delivered_synced_at'],
		)

	return {
		'scanned_rows': len(score_rows),
		'project_rows': project_rows,
		'updated_users': len(users_to_update),
	}


def sync_projects_from_coalition_scores(coalition_queryset=None, request_interval=0.25):
	coalitions = coalition_queryset if coalition_queryset is not None else Coalition.objects.order_by('coalition_id')
	ctx = _build_sync_context()
	processed_coalitions = 0
	bootstrapped_coalitions = 0
	total_scanned_rows = 0
	total_project_rows = 0
	total_updated_users = 0

	for coalition in coalitions:
		cursor, _created = CoalitionProjectCursor.objects.get_or_create(coalition=coalition)
		payload = _collect_new_coalition_project_scores(
			coalition=coalition,
			cursor=cursor,
			ctx=ctx,
			request_interval=request_interval,
		)
		processed_coalitions += 1

		if payload['newest_score_id'] is None:
			continue

		cursor.last_score_id = payload['newest_score_id']
		cursor.last_score_created_at = payload['newest_created_at']
		cursor.save(update_fields=['last_score_id', 'last_score_created_at', 'last_synced_at'])

		if payload['bootstrapped']:
			bootstrapped_coalitions += 1
			continue

		result = _apply_project_score_rows(
			score_rows=payload['new_rows'],
			ctx=ctx,
			request_interval=request_interval,
		)
		total_scanned_rows += result['scanned_rows']
		total_project_rows += result['project_rows']
		total_updated_users += result['updated_users']

	return {
		'processed_coalitions': processed_coalitions,
		'bootstrapped_coalitions': bootstrapped_coalitions,
		'scanned_rows': total_scanned_rows,
		'project_rows': total_project_rows,
		'updated_users': total_updated_users,
	}


def _find_project_score_cursor_at_or_before(coalition, cutoff, ctx, request_interval=0.25):
	page = 1
	cutoff = _ensure_aware_datetime(cutoff)

	while True:
		page_rows = _request_coalition_scores_page(
			coalition_id=coalition.coalition_id,
			ctx=ctx,
			page=page,
			request_interval=request_interval,
		).json()

		if not page_rows:
			break

		for row in page_rows:
			created_at = parse_datetime(row.get('created_at'))
			if created_at and _ensure_aware_datetime(created_at) <= cutoff:
				return row.get('id'), created_at, True

		page += 1

	return 0, None, False


def bootstrap_project_score_cursors_from_datetime(cutoff, coalition_queryset=None, request_interval=0.25):
	coalitions = coalition_queryset if coalition_queryset is not None else Coalition.objects.order_by('coalition_id')
	ctx = _build_sync_context()
	processed_coalitions = 0
	positioned_coalitions = 0
	full_scan_coalitions = 0

	for coalition in coalitions:
		score_id, created_at, exact_boundary_found = _find_project_score_cursor_at_or_before(
			coalition=coalition,
			cutoff=cutoff,
			ctx=ctx,
			request_interval=request_interval,
		)
		processed_coalitions += 1

		cursor, _created = CoalitionProjectCursor.objects.get_or_create(coalition=coalition)
		cursor.last_score_id = score_id
		cursor.last_score_created_at = created_at
		cursor.save(update_fields=['last_score_id', 'last_score_created_at', 'last_synced_at'])
		positioned_coalitions += 1
		if not exact_boundary_found:
			full_scan_coalitions += 1

	return {
		'processed_coalitions': processed_coalitions,
		'positioned_coalitions': positioned_coalitions,
		'full_scan_coalitions': full_scan_coalitions,
		'cutoff': _ensure_aware_datetime(cutoff),
	}


def sync_users_projects_delivered_in_batches(queryset, batch_size=100, request_interval=0.6, progress_callback=None):
	total_processed = 0
	total_updated = 0
	offset = 0
	batch_index = 0

	while True:
		batch = list(queryset[offset:offset + batch_size])
		if not batch:
			break

		batch_index += 1
		result = sync_users_projects_delivered(
			queryset=batch,
			request_interval=request_interval,
		)
		total_processed += result['processed']
		total_updated += result['updated']

		if progress_callback:
			progress_callback(
				batch_index=batch_index,
				offset=offset,
				processed=result['processed'],
				updated=result['updated'],
				total_processed=total_processed,
				total_updated=total_updated,
			)

		offset += batch_size

	return {
		'processed': total_processed,
		'updated': total_updated,
		'batches': batch_index,
	}
