import re
import time
from urllib.parse import parse_qs, urlparse

import requests

from .models import CampusUser
from .services import _build_sync_context


CURRENT_SEASON_START = '2025-09-30T00:00:00Z'
CURRENT_SEASON_END = '2026-03-27T23:59:59Z'


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


def _extract_last_page(response):
	total_pages = response.headers.get('x-total-pages')
	if total_pages and total_pages.isdigit():
		return int(total_pages)

	link_header = response.headers.get('link') or response.headers.get('Link') or ''
	for raw_link in link_header.split(','):
		if 'rel="last"' not in raw_link:
			continue
		match = re.search(r'<([^>]+)>', raw_link)
		if not match:
			continue
		url = match.group(1)
		page_values = parse_qs(urlparse(url).query).get('page')
		if page_values and page_values[0].isdigit():
			return int(page_values[0])

	return 1


def _fetch_evaluations_count(login, ctx=None, request_interval=0.6, extra_params=None):
	ctx = ctx or _build_sync_context()
	first_response = _request_evaluations_page(
		login=login,
		ctx=ctx,
		page=1,
		request_interval=request_interval,
		extra_params=extra_params,
	)
	first_page_items = first_response.json()
	last_page = _extract_last_page(first_response)

	if last_page <= 1:
		return len(first_page_items)

	last_response = _request_evaluations_page(
		login=login,
		ctx=ctx,
		page=last_page,
		request_interval=request_interval,
		extra_params=extra_params,
	)
	last_page_items = last_response.json()
	per_page = int(first_response.headers.get('x-per-page', 100))
	return ((last_page - 1) * per_page) + len(last_page_items)


def fetch_user_evaluations_done_total(login, ctx=None, request_interval=0.6):
	return _fetch_evaluations_count(
		login=login,
		ctx=ctx,
		request_interval=request_interval,
	)


def fetch_user_evaluations_done_current_season(login, ctx=None, request_interval=0.6):
	return _fetch_evaluations_count(
		login=login,
		ctx=ctx,
		request_interval=request_interval,
		extra_params={
			'range[filled_at]': f'{CURRENT_SEASON_START},{CURRENT_SEASON_END}',
		},
	)


def sync_users_evaluations_done_total(queryset=None, request_interval=0.6):
	users = queryset if queryset is not None else CampusUser.objects.filter(is_active=True).exclude(login='')
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
