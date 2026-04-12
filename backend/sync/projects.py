import time

import requests
from django.utils import timezone

from .models import CampusUser
from .services import _build_sync_context, _http_get, _request_42_token


CURRENT_SEASON_START = '2026-04-08T15:42:00Z'
CURRENT_SEASON_END = '2026-10-08T10:00:00Z'


# Objective:
# Fetch one `projects_users` page with finished projects for a single 42 login.
# Expects:
# - login: 42 login to query.
# - ctx: sync context containing base_url and auth headers.
# - page/per_page: pagination values for the API request.
# - request_interval: delay between requests to reduce API pressure.
# - extra_params: optional filters, for example a marked_at range.
# Returns:
# - A successful `requests.Response` object for the requested page.
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


# Objective:
# Decide whether a project row counts as one delivered project for this app.
# Expects:
# - project_user: row returned by `/v2/users/:login/projects_users`.
# - cursus_id: 42 cursus id to keep; this excludes piscine rows from other cursus ids.
# Returns:
# - True only for approved finished projects in the configured cursus.
def _is_delivered_project(project_user, cursus_id):
	cursus_ids = project_user.get('cursus_ids') or []
	cursus_ids = {str(value) for value in cursus_ids}
	return project_user.get('validated?') is True and str(cursus_id) in cursus_ids


# Objective:
# Count approved finished projects from already fetched API rows.
# Expects:
# - rows: project rows returned by the 42 API.
# - cursus_id: 42 cursus id to keep.
# Returns:
# - Number of rows that count as delivered projects for this app.
def _count_delivered_project_rows(rows, cursus_id):
	return sum(1 for row in rows if _is_delivered_project(row, cursus_id))


# Objective:
# Count approved finished projects for a user after applying the provided filters.
# Expects:
# - login: 42 login to query.
# - ctx: optional sync context; a fresh one is built if missing.
# - request_interval: delay between requests.
# - extra_params: optional API filters, for example a season date range.
# Returns:
# - An integer count after excluding failed projects and piscine projects.
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


# Objective:
# Get the user's lifetime number of approved delivered projects.
# Expects:
# - login: 42 login to query.
# - ctx: optional sync context.
# - request_interval: delay between requests.
# Returns:
# - The total number of approved finished projects for the user in the configured cursus.
def fetch_user_projects_delivered_total(login, ctx=None, request_interval=0.6):
	return _fetch_projects_count(
		login=login,
		ctx=ctx,
		request_interval=request_interval,
	)


# Objective:
# Get the user's approved delivered projects inside the current season window.
# Expects:
# - login: 42 login to query.
# - ctx: optional sync context.
# - request_interval: delay between requests.
# Returns:
# - The number of approved finished projects whose `marked_at` falls inside the configured season range.
def fetch_user_projects_delivered_current_season(login, ctx=None, request_interval=0.6):
	return _fetch_projects_count(
		login=login,
		ctx=ctx,
		request_interval=request_interval,
		extra_params={
			'range[marked_at]': f'{CURRENT_SEASON_START},{CURRENT_SEASON_END}',
		},
	)


# Objective:
# Sync delivered project counters from 42 into local `CampusUser` rows.
# Expects:
# - queryset: optional user queryset or list; defaults to every CampusUser with login.
# - request_interval: delay between requests.
# Returns:
# - A summary dict with processed and updated row counts.
def sync_users_projects_delivered(queryset=None, request_interval=0.6):
	users = queryset if queryset is not None else CampusUser.objects.exclude(login='').order_by('id')
	ctx = _build_sync_context()
	processed = 0
	updated = 0

	for user in users:
		total = fetch_user_projects_delivered_total(user.login, ctx=ctx, request_interval=request_interval)
		current_season = fetch_user_projects_delivered_current_season(
			user.login,
			ctx=ctx,
			request_interval=request_interval,
		)
		processed += 1

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
	}


# Objective:
# Execute the delivered-project sync in batches to avoid processing the whole dataset at once.
# Expects:
# - queryset: base queryset to iterate.
# - batch_size: number of users per batch.
# - request_interval: delay between requests.
# - progress_callback: optional callable invoked after each batch.
# Returns:
# - A summary dict with processed users, updated users, and executed batches.
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
