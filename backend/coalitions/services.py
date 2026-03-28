import requests
from requests import RequestException

from .models import Coalition

MADRID_BLOC_ID = 110


def _safe_42_get(url, access_token, *, params=None, timeout=10):
	try:
		response = requests.get(
			url,
			headers={'Authorization': f'Bearer {access_token}'},
			params=params,
			timeout=timeout,
		)
	except RequestException:
		return None

	if response.status_code != 200:
		return None

	return response.json()


def get_coalitions(base_url, access_token):
	payload = _safe_42_get(
		f"{base_url}/v2/blocs/{MADRID_BLOC_ID}/coalitions",
		access_token,
	)
	if not payload:
		return []
	return payload


def _sync_madrid_coalitions_from_api(base_url, access_token):
	coalitions_payload = get_coalitions(base_url, access_token)
	if not coalitions_payload:
		return list(Coalition.objects.order_by('-score', 'name'))

	coalitions = []
	for coalition_payload in coalitions_payload:
		coalition_id = coalition_payload.get('id')
		coalition_name = coalition_payload.get('name')
		coalition_slug = coalition_payload.get('slug')
		coalition_color = coalition_payload.get('color') or ''
		coalition_image_url = coalition_payload.get('image_url') or coalition_payload.get('image') or ''
		coalition_score = coalition_payload.get('score') or 0

		if coalition_id is None or not coalition_name or not coalition_slug:
			continue

		coalition = Coalition.objects.filter(intra_id=coalition_id).first() or Coalition.objects.filter(slug=coalition_slug).first()
		if coalition is None:
			coalition = Coalition(intra_id=coalition_id, name=coalition_name, slug=coalition_slug)

		coalition.intra_id = coalition_id
		coalition.name = coalition_name
		coalition.slug = coalition_slug
		coalition.color = coalition_color
		coalition.image_url = coalition_image_url
		coalition.score = coalition_score
		coalition.save()
		coalitions.append(coalition)

	return sorted(coalitions, key=lambda coalition: coalition.score, reverse=True)


def _get_madrid_coalitions():
	return list(Coalition.objects.order_by('-score', 'name'))


def _serialize_coalition_leaderboard():
	return [
		{
			'name': coalition.name,
			'total_points': coalition.score,
		}
		for coalition in _get_madrid_coalitions()
	]


def _find_user_rank_in_madrid(base_url, access_token, user_42_id, user_score):
	if user_42_id is None or user_score is None:
		return None

	coalition_ids = ",".join(str(coalition.intra_id) for coalition in _get_madrid_coalitions() if coalition.intra_id is not None)
	if not coalition_ids:
		return None

	users_ahead = 0
	page_number = 1
	while True:
		page_data = _safe_42_get(
			f'{base_url}/v2/coalitions_users',
			access_token,
			params={
				'filter[coalition_id]': coalition_ids,
				'range[this_year_score]': f'{user_score + 1},999999999',
				'page[size]': 100,
				'page[number]': page_number,
			},
			timeout=20,
		)
		if page_data is None:
			return None
		if not page_data:
			break

		users_ahead += len(page_data)
		if len(page_data) < 100:
			break
		page_number += 1

	page_number = 1
	while True:
		page_data = _safe_42_get(
			f'{base_url}/v2/coalitions_users',
			access_token,
			params={
				'filter[coalition_id]': coalition_ids,
				'filter[this_year_score]': user_score,
				'sort': 'user_id',
				'page[size]': 100,
				'page[number]': page_number,
			},
			timeout=20,
		)
		if page_data is None:
			return None
		if not page_data:
			break

		for entry in page_data:
			entry_user_id = entry.get('user_id')
			if entry_user_id is not None and entry_user_id < user_42_id:
				users_ahead += 1

		if len(page_data) < 100:
			break
		page_number += 1

	return users_ahead + 1


def _sync_profile_coalition(profile, user_42_id, base_url, access_token):
	if user_42_id is None:
		return

	coalitions_payload = _safe_42_get(
		f'{base_url}/v2/users/{user_42_id}/coalitions',
		access_token,
	)
	if coalitions_payload is None:
		return
	if not coalitions_payload:
		profile.coalition = None
		profile.coalition_user_score = 0
		profile.coalition_user_rank = None
		profile.campus_user_rank = None
		return

	coalition_payload = coalitions_payload[0]
	coalition_id = coalition_payload.get('id')
	coalition_name = coalition_payload.get('name')
	coalition_slug = coalition_payload.get('slug')
	coalition_color = coalition_payload.get('color') or ''
	coalition_image_url = (coalition_payload.get('image_url') or coalition_payload.get('image') or '')
	coalition_score = coalition_payload.get('score') or 0

	if coalition_id is None or not coalition_name or not coalition_slug:
		return

	coalition = Coalition.objects.filter(intra_id=coalition_id).first() or Coalition.objects.filter(slug=coalition_slug).first()
	if coalition is None:
		coalition = Coalition(
			intra_id=coalition_id,
			slug=coalition_slug,
			name=coalition_name,
			color=coalition_color,
			image_url=coalition_image_url,
			score=coalition_score,
		)
	else:
		coalition.intra_id = coalition_id
		coalition.slug = coalition_slug
		coalition.name = coalition_name
		coalition.color = coalition_color
		coalition.image_url = coalition_image_url
		coalition.score = coalition_score
	coalition.save()
	profile.coalition = coalition

	coalitions_users_payload = _safe_42_get(
		f'{base_url}/v2/users/{user_42_id}/coalitions_users',
		access_token,
	)
	if coalitions_users_payload is None:
		return
	coalition_user_stats = next(
		(
			coalition_user
			for coalition_user in coalitions_users_payload
			if coalition_user.get('coalition_id') == coalition_id
		),
		None,
	)
	if coalition_user_stats is None:
		profile.coalition_user_score = 0
		profile.coalition_user_rank = None
		profile.campus_user_rank = None
		return

	profile.coalition_user_score = coalition_user_stats.get('score') or 0
	profile.coalition_user_rank = coalition_user_stats.get('rank')
	profile.campus_user_rank = _find_user_rank_in_madrid(
		base_url,
		access_token,
		user_42_id,
		profile.coalition_user_score,
	)
