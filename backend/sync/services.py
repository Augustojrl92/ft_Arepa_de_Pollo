import os
import time

import requests
from django.utils.dateparse import parse_datetime
from .models import CampusUser, Coalition


_TOKEN_CACHE = {
	'access_token': None,
	'expires_at': 0,
}

def _request_42_token():
	base_url = os.getenv('FT_API_BASE_URL', 'https://api.intra.42.fr').rstrip('/')
	client_id = os.getenv('FT_CLIENT_ID')
	client_secret = os.getenv('FT_CLIENT_SECRET')

	if not client_id or not client_secret:
		raise ValueError('Faltan FT_CLIENT_ID o FT_CLIENT_SECRET en variables de entorno')

	response = requests.post(
		f'{base_url}/oauth/token',
		data={
			'grant_type': 'client_credentials',
			'client_id': client_id,
			'client_secret': client_secret,
		},
		timeout=10,
	)
	response.raise_for_status()

	data = response.json()
	access_token = data.get('access_token')
	expires_in = int(data.get('expires_in', 0))

	if not access_token:
		raise ValueError('La respuesta de /oauth/token no incluye access_token')

	# Margen de seguridad de 30s para evitar usar un token a punto de expirar.
	_TOKEN_CACHE['access_token'] = access_token
	_TOKEN_CACHE['expires_at'] = int(time.time()) + max(expires_in - 30, 0)

	return access_token

def _get_42_token():
	now = int(time.time())
	token = _TOKEN_CACHE.get('access_token')
	expires_at = int(_TOKEN_CACHE.get('expires_at', 0))

	if token and now < expires_at:
		return token

	return _request_42_token()

def _extract_user_id(cursus_user):
	user_payload = cursus_user.get('user') or {}
	return user_payload.get('id') or cursus_user.get('user_id')

def _paged_get(endpoint, headers, params, request_interval=0.25, max_pages=None):
	"""Realiza GET paginado con pausa entre peticiones."""
	results = []
	page = 1

	while True:
		time.sleep(max(request_interval, 0))
		last_exc = None
		response = None
		for attempt in range(3):
			try:
				response = requests.get(
					endpoint,
					headers=headers,
					params={**params, 'page': page},
					timeout=20,
				)
				if response.status_code == 429 or 500 <= response.status_code < 600:
					time.sleep(min(2 ** attempt, 4))
					continue
				break
			except requests.RequestException as exc:
				last_exc = exc
				time.sleep(min(2 ** attempt, 4))

		if response is None:
			raise last_exc

		response.raise_for_status()

		page_data = response.json()
		if not page_data:
			break

		results.extend(page_data)
		print(f'Fetched page {page} with {len(page_data)} rows. Total: {len(results)}')

		total = int(response.headers.get('x-total', 0))
		header_per_page = int(response.headers.get('x-per-page', params.get('per_page', 100)))
		total_pages = (total + header_per_page - 1) // header_per_page if header_per_page else 0

		if max_pages and page >= max_pages:
			break

		if page >= total_pages:
			break

		page += 1

	return results

def _build_coalition_map(coalitions, coalitions_users):
	coalition_by_id = {}
	for coalition in coalitions:
		coalition_id = coalition.get('id')
		if coalition_id is None:
			continue
		coalition_by_id[coalition_id] = {
			'coalition_id': coalition_id,
			'coalition_name': coalition.get('name') or '',
			'coalition_slug': coalition.get('slug') or '',
			'coalition_total_score': coalition.get('score') or 0,
			'coalition_color': coalition.get('color') or '',
			'coalition_image_url': coalition.get('image_url') or '',
			'coalition_cover_url': coalition.get('cover_url') or '',
		}

	coalition_data_by_user_id = {}
	for coalition_user in coalitions_users:
		user_id = coalition_user.get('user_id')
		coalition_id = coalition_user.get('coalition_id')
		if not user_id or coalition_id is None:
			continue

		base_data = coalition_by_id.get(coalition_id, {
			'coalition_id': coalition_id,
			'coalition_name': '',
			'coalition_slug': '',
			'coalition_total_score': 0,
			'coalition_color': '',
			'coalition_image_url': '',
			'coalition_cover_url': '',
		})
		coalition_data_by_user_id[user_id] = {
			**base_data,
			'coalition_score': coalition_user.get('score') or 0,
		}

	return coalition_data_by_user_id

def save_coalitions_to_database(coalitions):
	"""Guarda las coaliciones en su modelo dedicado."""
	created_count = 0
	updated_count = 0

	for coalition in coalitions:
		coalition_id = coalition.get('id')
		if not coalition_id:
			continue

		_, created = Coalition.objects.update_or_create(
			coalition_id=coalition_id,
			defaults={
				'name': coalition.get('name') or '',
				'slug': coalition.get('slug') or '',
				'image_url': coalition.get('image_url') or '',
				'cover_url': coalition.get('cover_url') or '',
				'color': coalition.get('color') or '',
				'total_score': coalition.get('score') or 0,
				'leader_user_id': coalition.get('user_id'),
			},
		)

		if created:
			created_count += 1
		else:
			updated_count += 1

	print(f'Saved {created_count} new coalitions, updated {updated_count} existing coalitions.')
	return created_count, updated_count

def filter_and_save_to_database(cursus_users, coalition_data_by_user_id):
	"""Filter and save active users to the database."""
	created_count = 0
	update_count = 0
	skipped_count = 0

	valid_coalition_ids = set(Coalition.objects.values_list('coalition_id', flat=True))

	for cursus_user in cursus_users:
		user_payload = cursus_user.get('user') or {}
		user_id = _extract_user_id(cursus_user)
		is_staff = user_payload.get('staff?') or False

		if not user_id or is_staff:
			skipped_count += 1
			continue

		image_payload = user_payload.get('image') or {}
		pool_year_value = user_payload.get('pool_year')
		try:
			pool_year = int(pool_year_value) if pool_year_value else None
		except (TypeError, ValueError):
			pool_year = None

		coalition_data = coalition_data_by_user_id.get(user_id, {})
		coalition_id = coalition_data.get('coalition_id')

		if coalition_id not in valid_coalition_ids:
			skipped_count += 1
			continue

		defaults = {
			'user_id': user_id,
			'grade': cursus_user.get('grade') or '',
			'level': cursus_user.get('level') or 0,
			'login': user_payload.get('login') or '',
			'email': user_payload.get('email') or '',
			'display_name': user_payload.get('displayname') or '',
			'avatar_url': image_payload.get('link') or '',
			'wallet': user_payload.get('wallet') or 0,
			'correction_points': user_payload.get('correction_point') or 0,
			'pool_month': user_payload.get('pool_month') or '',
			'pool_year': pool_year,
			'is_active': bool(user_payload.get('active?', True)),
			'coalition_id': coalition_id,
			'coalition_name': coalition_data.get('coalition_name', ''),
			'coalition_user_score': coalition_data.get('coalition_score', 0),
			'coalition_total_score': coalition_data.get('coalition_total_score', 0),
			'created_at': parse_datetime(cursus_user.get('created_at')),
			'updated_at': parse_datetime(cursus_user.get('updated_at')),
		}

		_, created = CampusUser.objects.update_or_create(
			intra_id=user_id,
			defaults=defaults,
		)

		if created:
			created_count += 1
		else:
			update_count += 1

	print(
		f'Saved {created_count} new users, '
		f'updated {update_count} existing users, '
		f'skipped {skipped_count} users with invalid coalition.'
	)
	return created_count, update_count, skipped_count

def _build_sync_context(campus_id=22, cursus_id=21, bloc_id=110, per_page=100):
	token = _get_42_token()
	base_url = os.getenv('FT_API_BASE_URL', 'https://api.intra.42.fr').rstrip('/')
	headers = {'Authorization': f'Bearer {token}'}
	return {
		'campus_id': campus_id,
		'cursus_id': cursus_id,
		'bloc_id': bloc_id,
		'per_page': per_page,
		'base_url': base_url,
		'headers': headers,
	}

def fetch_campus_users_data(ctx, request_interval=0.25, max_pages=None):
	print('1 - Obteniendo usuarios del campus')
	return _paged_get(
		endpoint=f"{ctx['base_url']}/v2/cursus_users",
		headers=ctx['headers'],
		params={
			"filter[campus_id]": ctx['campus_id'],
			"filter[cursus_id]": ctx['cursus_id'],
			"filter[has_coalition]": "true",
			"per_page": ctx['per_page'],
		},
		request_interval=request_interval,
		max_pages=max_pages,
	)

def fetch_coalitions_data(ctx, request_interval=0.25):
	print('2 - Obteniendo datos de coaliciones')
	coalitions = _paged_get(
		endpoint=f"{ctx['base_url']}/v2/blocs/{ctx['bloc_id']}/coalitions",
		headers=ctx['headers'],
		params={"per_page": ctx['per_page']},
		request_interval=request_interval,
	)
	coalitions_created, coalitions_updated = save_coalitions_to_database(coalitions)

	coalitions_users = []
	for coalition in coalitions:
		coalition_id = coalition.get('id')
		if not coalition_id:
			continue

		print(f'Obteniendo datos de {coalition.get("name")} (ID {coalition_id})')
		coalition_users_rows = _paged_get(
			endpoint=f"{ctx['base_url']}/v2/coalitions_users",
			headers=ctx['headers'],
			params={
				"filter[coalition_id]": coalition_id,
				"per_page": ctx['per_page'],
			},
			request_interval=request_interval,
		)
		coalitions_users.extend(coalition_users_rows)

	coalition_data_by_user_id = _build_coalition_map(
		coalitions=coalitions,
		coalitions_users=coalitions_users,
	)

	return {
		'coalitions': coalitions,
		'coalitions_users': coalitions_users,
		'coalition_data_by_user_id': coalition_data_by_user_id,
		'coalitions_created': coalitions_created,
		'coalitions_updated': coalitions_updated,
	}

def run_full_sync(request_interval=0.25, max_pages=None):
	ctx = _build_sync_context()
	all_results = fetch_campus_users_data(
		ctx=ctx,
		request_interval=request_interval,
		max_pages=max_pages,
	)
	coalition_info = fetch_coalitions_data(
		ctx=ctx,
		request_interval=request_interval,
	)

	print('3 - Guardando en la base de datos')
	created_count, updated_count, skipped_count = filter_and_save_to_database(
		cursus_users=all_results,
		coalition_data_by_user_id=coalition_info['coalition_data_by_user_id'],
	)

	return {
		'total_fetched': len(all_results),
		'total_coalitions': len(coalition_info['coalitions']),
		'total_coalitions_users': len(coalition_info['coalitions_users']),
		'coalitions_created': coalition_info['coalitions_created'],
		'coalitions_updated': coalition_info['coalitions_updated'],
		'created_count': created_count,
		'updated_count': updated_count,
		'skipped_count': skipped_count,
		'campus_id': ctx['campus_id'],
		'cursus_id': ctx['cursus_id'],
	}

def run_users_only_sync(request_interval=0.25, max_pages=None):
	ctx = _build_sync_context()
	all_results = fetch_campus_users_data(
		ctx=ctx,
		request_interval=request_interval,
		max_pages=max_pages,
	)

	print('3 - Guardando en la base de datos (sin actualizar coaliciones)')
	created_count, updated_count, skipped_count = filter_and_save_to_database(
		cursus_users=all_results,
		coalition_data_by_user_id={},
	)

	return {
		'total_fetched': len(all_results),
		'total_coalitions': 0,
		'total_coalitions_users': 0,
		'coalitions_created': 0,
		'coalitions_updated': 0,
		'created_count': created_count,
		'updated_count': updated_count,
		'skipped_count': skipped_count,
		'campus_id': ctx['campus_id'],
		'cursus_id': ctx['cursus_id'],
	}

def run_coalitions_only_sync(request_interval=0.25):
	ctx = _build_sync_context()
	coalition_info = fetch_coalitions_data(
		ctx=ctx,
		request_interval=request_interval,
	)

	return {
		'total_fetched': 0,
		'total_coalitions': len(coalition_info['coalitions']),
		'total_coalitions_users': len(coalition_info['coalitions_users']),
		'coalitions_created': coalition_info['coalitions_created'],
		'coalitions_updated': coalition_info['coalitions_updated'],
		'created_count': 0,
		'updated_count': 0,
		'skipped_count': 0,
		'campus_id': ctx['campus_id'],
		'cursus_id': ctx['cursus_id'],
	}