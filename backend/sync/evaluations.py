import time

import requests
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from .models import CampusUser, Coalition, CoalitionEvaluationCursor
from .services import _build_sync_context


CURRENT_SEASON_START = '2025-09-30T00:00:00Z'
CURRENT_SEASON_END = '2026-03-27T23:59:59Z'
CURRENT_SEASON_START_DT = parse_datetime(CURRENT_SEASON_START)
CURRENT_SEASON_END_DT = parse_datetime(CURRENT_SEASON_END)
EVALUATION_SCORE_REASON = 'You evaluated someone. Well done!'

# Objective:
# Fetch a single filled `as_corrector` page from the 42 API.
# Expects:
# - login: 42 login to query.
# - ctx: sync context containing base_url and auth headers.
# - page/per_page: pagination values for the API request.
# - request_interval: delay between requests to reduce API pressure.
# - extra_params: optional extra filters such as a filled_at range.
# Returns:
# - A successful `requests.Response` object for the requested page.
def _request_evaluations_page(login, ctx, page=1, per_page=100, request_interval=0.6, extra_params=None):
	params = {
		'page': page,
		'per_page': per_page,
		'filter[filled]': 'true',
	}
	if extra_params:
		params.update(extra_params)

	time.sleep(max(request_interval, 0))
	last_exc = None
	response = None

	for attempt in range(4):
		try:
			response = requests.get(
				f"{ctx['base_url']}/v2/users/{login}/scale_teams/as_corrector",
				headers=ctx['headers'],
				params=params,
				timeout=20,
			)
			if response.status_code == 429 or 500 <= response.status_code < 600:
				time.sleep(min(2 ** attempt, 8))
				continue
			break
		except requests.RequestException as exc:
			last_exc = exc
			time.sleep(min(2 ** attempt, 8))

	if response is None:
		raise last_exc

	response.raise_for_status()
	return response

# Objective:
# Get the number of evaluations for a user after applying the provided filters.
# Expects:
# - login: 42 login to query.
# - ctx: optional sync context; a fresh one is built if missing.
# - request_interval: delay between requests.
# - extra_params: optional API filters, for example a season date range.
# Returns:
# - An integer count, using the `x-total` response header when available.
def _fetch_evaluations_count(login, ctx=None, request_interval=0.6, extra_params=None):
	ctx = ctx or _build_sync_context()
	first_response = _request_evaluations_page(
		login=login,
		ctx=ctx,
		page=1,
		request_interval=request_interval,
		extra_params=extra_params,
	)
	total = first_response.headers.get('x-total')
	if total and total.isdigit():
		return int(total)

	return len(first_response.json())

# Objective:
# Get the user's lifetime number of completed evaluations as corrector.
# Expects:
# - login: 42 login to query.
# - ctx: optional sync context.
# - request_interval: delay between requests.
# Returns:
# - The total number of completed evaluations for the user.
def fetch_user_evaluations_done_total(login, ctx=None, request_interval=0.6):
	return _fetch_evaluations_count(
		login=login,
		ctx=ctx,
		request_interval=request_interval,
	)

# Objective:
# Get the user's completed evaluations inside the current season window.
# Expects:
# - login: 42 login to query.
# - ctx: optional sync context.
# - request_interval: delay between requests.
# Returns:
# - The number of completed evaluations whose `filled_at` falls inside the configured season range.
def fetch_user_evaluations_done_current_season(login, ctx=None, request_interval=0.6):
	return _fetch_evaluations_count(
		login=login,
		ctx=ctx,
		request_interval=request_interval,
		extra_params={
			'range[filled_at]': f'{CURRENT_SEASON_START},{CURRENT_SEASON_END}',
		},
	)

# Objective:
# Sync evaluation counters from 42 into local `CampusUser` rows.
# Expects:
# - queryset: optional user queryset or list; defaults to every CampusUser with login.
# - request_interval: delay between requests.
# Returns:
# - A summary dict with processed and updated row counts.
def sync_users_evaluations_done_total(queryset=None, request_interval=0.6):
	users = queryset if queryset is not None else CampusUser.objects.exclude(login='').order_by('id')
	ctx = _build_sync_context()
	processed = 0
	updated = 0

	for user in users:
		total = fetch_user_evaluations_done_total(user.login, ctx=ctx, request_interval=request_interval)
		current_season = fetch_user_evaluations_done_current_season(
			user.login,
			ctx=ctx,
			request_interval=request_interval,
		)
		processed += 1
		synced_at = timezone.now()

		fields_to_update = []
		if user.evaluations_done_total != total:
			user.evaluations_done_total = total
			fields_to_update.append('evaluations_done_total')
		if user.evaluations_done_current_season != current_season:
			user.evaluations_done_current_season = current_season
			fields_to_update.append('evaluations_done_current_season')
		user.evaluations_synced_at = synced_at
		fields_to_update.append('evaluations_synced_at')

		user.save(update_fields=fields_to_update)
		if len(fields_to_update) > 1:
			updated += 1

	return {
		'processed': processed,
		'updated': updated,
	}

# Objective:
# Execute the evaluation sync in batches to avoid processing the whole dataset at once.
# Expects:
# - queryset: base queryset to iterate.
# - batch_size: number of users per batch.
# - request_interval: delay between requests.
# - progress_callback: optional callable invoked after each batch.
# Returns:
# - A summary dict with processed users, updated users, and executed batches.
def sync_users_evaluations_done_total_in_batches(queryset, batch_size=100, request_interval=0.6, progress_callback=None):
	total_processed = 0
	total_updated = 0
	offset = 0
	batch_index = 0

	while True:
		batch = list(queryset[offset:offset + batch_size])
		if not batch:
			break

		batch_index += 1
		result = sync_users_evaluations_done_total(
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

# Objective:
# Fetch one coalition score page ordered from newest to oldest.
# Expects:
# - coalition_id: coalition identifier in 42.
# - ctx: sync context containing base_url and auth headers.
# - page/per_page: pagination values for the API request.
# - request_interval: delay between requests to reduce API pressure.
# Returns:
# - A successful `requests.Response` object for the requested page.
def _request_coalition_scores_page(coalition_id, ctx, page=1, per_page=100, request_interval=0.25):
	time.sleep(max(request_interval, 0))
	last_exc = None
	response = None

	for attempt in range(4):
		try:
			response = requests.get(
				f"{ctx['base_url']}/v2/coalitions/{coalition_id}/scores",
				headers=ctx['headers'],
				params={
					'page': page,
					'per_page': per_page,
					'sort': '-created_at',
				},
				timeout=20,
			)
			if response.status_code == 429 or 500 <= response.status_code < 600:
				time.sleep(min(2 ** attempt, 8))
				continue
			break
		except requests.RequestException as exc:
			last_exc = exc
			time.sleep(min(2 ** attempt, 8))

	if response is None:
		raise last_exc

	response.raise_for_status()
	return response

# Objective:
# Decide whether a score row counts as one completed correction event.
# Expects:
# - score_event: row returned by `/v2/coalitions/:id/scores`.
# Returns:
# - True only for evaluation score events that can be mapped to a coalition user.
def _is_evaluation_score_event(score_event):
	return (
		score_event.get('reason') == EVALUATION_SCORE_REASON
		and score_event.get('coalitions_user_id') is not None
	)

# Objective:
# Collect every new score row for one coalition since the stored cursor.
# Expects:
# - coalition: local coalition model instance.
# - cursor: stored cursor row for that coalition.
# - ctx: sync context containing base_url and auth headers.
# - request_interval: delay between requests.
# Returns:
# - A dict with the newest seen score metadata, collected new rows, and whether the cursor was bootstrapped.
def _collect_new_coalition_scores(coalition, cursor, ctx, request_interval=0.25):
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

# Objective:
# Apply new evaluation score events to local counters using coalitions_user_id as the local join key.
# Expects:
# - score_rows: new coalition score rows ordered from newest to oldest.
# Returns:
# - A summary dict with scanned rows, evaluation rows, and updated users.
def _apply_evaluation_score_rows(score_rows):
	increments_by_coalitions_user_id = {}

	for row in score_rows:
		if not _is_evaluation_score_event(row):
			continue

		coalitions_user_id = row.get('coalitions_user_id')
		created_at = parse_datetime(row.get('created_at'))
		counters = increments_by_coalitions_user_id.setdefault(
			coalitions_user_id,
			{'total': 0, 'season': 0},
		)
		counters['total'] += 1
		if created_at and CURRENT_SEASON_START_DT <= created_at <= CURRENT_SEASON_END_DT:
			counters['season'] += 1

	if not increments_by_coalitions_user_id:
		return {
			'scanned_rows': len(score_rows),
			'evaluation_rows': 0,
			'updated_users': 0,
		}

	users = list(
		CampusUser.objects.filter(
			coalitions_user_id__in=increments_by_coalitions_user_id.keys()
		)
	)
	users_by_coalitions_user_id = {user.coalitions_user_id: user for user in users}
	now = timezone.now()
	users_to_update = []
	evaluation_rows = 0

	for coalitions_user_id, counters in increments_by_coalitions_user_id.items():
		user = users_by_coalitions_user_id.get(coalitions_user_id)
		if user is None:
			continue

		evaluation_rows += counters['total']
		user.evaluations_done_total += counters['total']
		user.evaluations_done_current_season += counters['season']
		user.evaluations_synced_at = now
		users_to_update.append(user)

	if users_to_update:
		CampusUser.objects.bulk_update(
			users_to_update,
			['evaluations_done_total', 'evaluations_done_current_season', 'evaluations_synced_at'],
		)

	return {
		'scanned_rows': len(score_rows),
		'evaluation_rows': evaluation_rows,
		'updated_users': len(users_to_update),
	}

# Objective:
# Increment local evaluation counters by reading recent coalition score events instead of recounting every user.
# Expects:
# - coalition_queryset: optional local coalition queryset; defaults to every synced coalition.
# - request_interval: delay between requests.
# Returns:
# - A summary dict with processed coalitions, bootstrapped cursors, scanned rows, evaluation rows, and updated users.
def sync_evaluations_from_coalition_scores(coalition_queryset=None, request_interval=0.25):
	coalitions = coalition_queryset if coalition_queryset is not None else Coalition.objects.order_by('coalition_id')
	ctx = _build_sync_context()
	processed_coalitions = 0
	bootstrapped_coalitions = 0
	total_scanned_rows = 0
	total_evaluation_rows = 0
	total_updated_users = 0

	for coalition in coalitions:
		cursor, _created = CoalitionEvaluationCursor.objects.get_or_create(coalition=coalition)
		payload = _collect_new_coalition_scores(
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

		result = _apply_evaluation_score_rows(payload['new_rows'])
		total_scanned_rows += result['scanned_rows']
		total_evaluation_rows += result['evaluation_rows']
		total_updated_users += result['updated_users']

	return {
		'processed_coalitions': processed_coalitions,
		'bootstrapped_coalitions': bootstrapped_coalitions,
		'scanned_rows': total_scanned_rows,
		'evaluation_rows': total_evaluation_rows,
		'updated_users': total_updated_users,
	}
