import os
import secrets

import requests
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

from .models import FortyTwoProfile

# Create your views here.


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

		if token_data.status_code != 200:
			return _redirect_with_error('Failed to obtain access token')
		
		access_token = token_data.json().get('access_token')
		if not access_token:
			return _redirect_with_error('Access token not found in response')
		
		user_data = requests.get(
			f'{base_url}/v2/me',
			headers={'Authorization': f'Bearer {access_token}'},
			timeout=10
		)
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
                "coalition": "",
                "intra_level": 0,
                "intra_wallet": user_42.get("wallet", 0),
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
			'coalition': profile.coalition,
		}
		return Response(data, status=status.HTTP_200_OK)


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
