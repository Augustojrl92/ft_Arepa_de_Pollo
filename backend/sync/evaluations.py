import time

import requests

from .models import CampusUser
from .services import _build_sync_context


CURRENT_SEASON_START = '2025-09-30T00:00:00Z'
CURRENT_SEASON_END = '2026-03-27T23:59:59Z'

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

		fields_to_update = []
		if user.evaluations_done_total != total:
			user.evaluations_done_total = total
			fields_to_update.append('evaluations_done_total')
		if user.evaluations_done_current_season != current_season:
			user.evaluations_done_current_season = current_season
			fields_to_update.append('evaluations_done_current_season')

		if fields_to_update:
			user.save(update_fields=fields_to_update)
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
