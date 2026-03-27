import os
import secrets

import requests
from requests import RequestException
from urllib.parse import urlencode
from django.conf import settings
from django.contrib.auth.models import User
from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from .models import Coalition, FortyTwoProfile

# Create your views here.

MADRID_COALITIONS = [
	{"id": 399, "name": "Tiamant", "slug": "tiamant", "color": "#9FC131", "image_url": "", "score": 1776878},
	{"id": 401, "name": "Zefiria", "slug": "zefiria", "color": "#E39F0B", "image_url": "https://cdn.intra.42.fr/coalition/image/401/42madrid_coaliciones_logos-08.svg", "score": 1781388},
	{"id": 400, "name": "Marventis", "slug": "marventis", "color": "#1B5971", "image_url": "", "score": 1685123},
	{"id": 398, "name": "Ignisaria", "slug": "ignisaria", "color": "#C2301D", "image_url": "", "score": 1320416},
]


def _build_42_authorize_url(request):
	client_id = os.getenv('FT_CLIENT_ID')
	redirect_uri = os.getenv('FT_REDIRECT_URI')
	base_url = os.getenv('FT_API_BASE_URL', 'https://api.intra.42.fr').rstrip('/')

	if not client_id or not redirect_uri:
		return None, None, Response(
			{'error': 'OAuth configuration is missing: FT_CLIENT_ID or FT_REDIRECT_URI'},
			status=status.HTTP_500_INTERNAL_SERVER_ERROR,
		)

	state = secrets.token_urlsafe(32)
	request.session['oauth42_state'] = state

	params = {
		'client_id': client_id,
		'redirect_uri': redirect_uri,
		'response_type': 'code',
		'scope': 'public',
		'state': state,
	}
	auth_url = f"{base_url}/oauth/authorize?{urlencode(params)}"
	return auth_url, state, None


def _cookie_options():
	return {
		'httponly': True,
		'secure': os.getenv('JWT_COOKIE_SECURE', 'False').lower() == 'true',
		'samesite': os.getenv('JWT_COOKIE_SAMESITE', 'Lax'),
		'path': '/',
	}


def _set_auth_cookies(response, refresh_token):
	options = _cookie_options()
	access_lifetime = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
	refresh_lifetime = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())

	response.set_cookie(
		'access_token',
		str(refresh_token.access_token),
		max_age=access_lifetime,
		**options,
	)
	response.set_cookie(
		'refresh_token',
		str(refresh_token),
		max_age=refresh_lifetime,
		**options,
	)


def _clear_auth_cookies(response):
	options = _cookie_options()
	response.delete_cookie('access_token', path=options['path'], samesite=options['samesite'])
	response.delete_cookie('refresh_token', path=options['path'], samesite=options['samesite'])


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


def _ensure_madrid_coalitions():
	coalitions = []
	for coalition_payload in MADRID_COALITIONS:
		coalition = Coalition.objects.filter(intra_id=coalition_payload['id']).first() or Coalition.objects.filter(slug=coalition_payload['slug']).first()
		if coalition is None:
			coalition = Coalition(
				intra_id=coalition_payload['id'],
				name=coalition_payload['name'],
				slug=coalition_payload['slug'],
			)
		coalition.intra_id = coalition_payload['id']
		coalition.name = coalition_payload['name']
		coalition.slug = coalition_payload['slug']
		coalition.color = coalition_payload['color']
		coalition.image_url = coalition_payload['image_url']
		coalition.score = coalition_payload['score']
		coalition.save()
		coalitions.append(coalition)
	return sorted(coalitions, key=lambda coalition: coalition.score, reverse=True)


def _sync_madrid_coalitions_from_api(base_url, access_token):
	coalitions = []
	for fallback_payload in MADRID_COALITIONS:
		coalition_payload = fallback_payload
		coalition_response = _safe_42_get(
			f"{base_url}/v2/coalitions/{fallback_payload['id']}",
			access_token,
		)
		if coalition_response is not None:
			coalition_payload = coalition_response

		coalition_id = coalition_payload.get('id', fallback_payload['id'])
		coalition_name = coalition_payload.get('name', fallback_payload['name'])
		coalition_slug = coalition_payload.get('slug', fallback_payload['slug'])
		coalition_color = coalition_payload.get('color') or fallback_payload['color']
		coalition_image_url = (coalition_payload.get('image_url') or coalition_payload.get('image') or fallback_payload['image_url'])
		coalition_score = coalition_payload.get('score')
		if coalition_score is None:
			coalition_score = fallback_payload['score']

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
	coalitions = list(Coalition.objects.filter(intra_id__in=[payload['id'] for payload in MADRID_COALITIONS]).order_by('-score', 'name'))
	if len(coalitions) < len(MADRID_COALITIONS):
		coalitions = _ensure_madrid_coalitions()
	return coalitions


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

	coalition_ids = ",".join(str(coalition["id"]) for coalition in MADRID_COALITIONS)

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


class OAuth42LoginUrlView(APIView):
	permission_classes = [AllowAny]

	def get(self, request):
		auth_url, _state, error_response = _build_42_authorize_url(request)
		if error_response:
			return error_response
		return Response({'authorize_url': auth_url}, status=status.HTTP_200_OK)

# Returns the URL to redirect the user to for 42 OAuth login
class OAuth42LoginView(APIView):
	permission_classes = [AllowAny]

	def get(self, request):
		auth_url, _state, error_response = _build_42_authorize_url(request)
		if error_response:
			return error_response
		return redirect(auth_url)

# Handles the callback from 42 OAuth and creates/updates the user and profile
class OAuth42CallbackView(APIView):
	permission_classes = [AllowAny]

	def get(self, request):
		frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')

		def _redirect_with_error(message):
			params = urlencode({'error': message})
			return redirect(f"{frontend_url}/login/?{params}")

		code = request.query_params.get('code')
		received_state = request.query_params.get('state')
		expected_state = request.session.pop('oauth42_state', None)

		if not code:
			return _redirect_with_error('Authorization code not provided')

		if not expected_state or not received_state or received_state != expected_state:
			return _redirect_with_error('Invalid OAuth state')

		base_url = os.getenv("FT_API_BASE_URL", "https://api.intra.42.fr")

		try:
			token_data = requests.post(
				f'{base_url}/oauth/token',
				data={
					'grant_type': 'authorization_code',
					'client_id': os.getenv('FT_CLIENT_ID'),
					'client_secret': os.getenv('FT_CLIENT_SECRET'),
					'code': code,
					'redirect_uri': os.getenv('FT_REDIRECT_URI'),
				},
				timeout=10
			)
		except RequestException:
			return _redirect_with_error('Failed to obtain access token')

		if token_data.status_code != 200:
			return _redirect_with_error('Failed to obtain access token')
		
		access_token = token_data.json().get('access_token')
		if not access_token:
			return _redirect_with_error('Access token not found in response')
		
		try:
			user_data = requests.get(
				f'{base_url}/v2/me',
				headers={'Authorization': f'Bearer {access_token}'},
				timeout=10
			)
		except RequestException:
			return _redirect_with_error('Failed to fetch user data')
		if user_data.status_code != 200:
			return _redirect_with_error('Failed to fetch user data')

		user_42 = user_data.json()
		if not user_42:
			return _redirect_with_error('Failed to fetch user data')
		
		login = user_42.get('login')
		email = user_42.get('email')

		if not login:
			return _redirect_with_error('Missing login in 42 payload')

		user, _created = User.objects.get_or_create(
            username=login,
            defaults={"email": email},
        )

		if email and user.email != email:
			user.email = email
			user.save(update_fields=["email"])

		profile, _ = FortyTwoProfile.objects.get_or_create(
            user=user,
            defaults={
                "intra_id": str(user_42.get("id", "")),
                "eval_points": user_42.get("correction_point", 0),
                "login": login,
                "display_name": user_42.get("displayname", login),
                "email": email,
                "avatar_url": (user_42.get("image") or {}).get("link", ""),
                "coalition": None,
                "intra_level": 0,
                "intra_wallet": user_42.get("wallet", 0),
				"eval_points": user_42.get("correction_point", 0),
            },
        )

		# Keep profile in sync on every login when 42 data changes.
		profile.intra_id = user_42.get("id", profile.intra_id)
		profile.login = login
		profile.display_name = user_42.get("displayname", login)
		profile.email = email
		profile.avatar_url = (user_42.get("image") or {}).get("link", profile.avatar_url)
		profile.intra_wallet = user_42.get("wallet", profile.intra_wallet)
		profile.eval_points = user_42.get("correction_point", profile.eval_points)

		cursus_users = user_42.get("cursus_users") or []
		selected_cursus = next(
			(
				cursus_user
				for cursus_user in cursus_users
				if ((cursus_user.get("cursus") or {}).get("name") or "").lower() == "42cursus"
			),
			None,
		)
		if selected_cursus and selected_cursus.get("level") is not None:
			profile.intra_level = selected_cursus.get("level")
		_sync_madrid_coalitions_from_api(base_url, access_token)
		_sync_profile_coalition(profile, user_42.get("id"), base_url, access_token)

		profile.save()

		refresh = RefreshToken.for_user(user)
		response = redirect(f"{frontend_url}/")
		_set_auth_cookies(response, refresh)
		return response

# Returns the authenticated user's profile information
class UserProfileView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		user = request.user
		profile = getattr(user, 'forty_two_profile', None)
		if not profile:
			return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

		rank_by_slug = {
			coalition.slug: index
			for index, coalition in enumerate(_get_madrid_coalitions(), start=1)
		}

		data = {
			'user_id': user.id,
			'username': user.username,
			'intra_id': profile.intra_id,
			'intra_level': profile.intra_level,
			'intra_wallet': profile.intra_wallet,
			'eval_points': profile.eval_points,
			'login': profile.login,
			'display_name': profile.display_name,
			'email': profile.email,
			'avatar_url': profile.avatar_url,
			'coalition': profile.coalition.slug if profile.coalition else None,
			'coalition_points': profile.coalition_user_score,
			'coalition_rank': rank_by_slug.get(profile.coalition.slug) if profile.coalition else None,
			'campus_user_rank': profile.campus_user_rank,
			'coalition_user_rank': profile.coalition_user_rank,
		}
		return Response(data, status=status.HTTP_200_OK)


class CoalitionLeaderboardView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		return Response(
			{'coalitions': _serialize_coalition_leaderboard()},
			status=status.HTTP_200_OK,
		)


class AuthTokenRefreshView(APIView):
	permission_classes = [AllowAny]

	def post(self, request):
		refresh_token = request.data.get('refresh') or request.COOKIES.get('refresh_token')

		if not refresh_token:
			return Response({'error': 'Refresh token not provided'}, status=status.HTTP_400_BAD_REQUEST)

		serializer = TokenRefreshSerializer(data={'refresh': refresh_token})
		if not serializer.is_valid():
			response = Response({'error': 'Invalid refresh token'}, status=status.HTTP_401_UNAUTHORIZED)
			_clear_auth_cookies(response)
			return response

		validated = serializer.validated_data
		response = Response({'detail': 'Token refreshed'}, status=status.HTTP_200_OK)

		options = _cookie_options()
		access_lifetime = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
		response.set_cookie(
			'access_token',
			validated['access'],
			max_age=access_lifetime,
			**options,
		)

		if 'refresh' in validated:
			refresh_lifetime = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
			response.set_cookie(
				'refresh_token',
				validated['refresh'],
				max_age=refresh_lifetime,
				**options,
			)

		return response


class AuthLogoutView(APIView):
	permission_classes = [AllowAny]

	def post(self, request):
		response = Response({'detail': 'Logout successful'}, status=status.HTTP_200_OK)
		_clear_auth_cookies(response)
		return response
