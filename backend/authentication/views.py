import os
import secrets

import requests
from urllib.parse import urlencode
from django.contrib.auth.models import User
from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

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
		code = request.query_params.get('code')
		received_state = request.query_params.get('state')
		expected_state = request.session.pop('oauth42_state', None)

		if not code:
			return Response({'error': 'Authorization code not provided'}, status=status.HTTP_400_BAD_REQUEST)

		if not expected_state or not received_state or received_state != expected_state:
			return Response({'error': 'Invalid OAuth state'}, status=status.HTTP_400_BAD_REQUEST)

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
			return Response({'error': 'Failed to obtain access token'}, status=status.HTTP_400_BAD_REQUEST)
		
		access_token = token_data.json().get('access_token')
		if not access_token:
			return Response({'error': 'Access token not found in response'}, status=status.HTTP_400_BAD_REQUEST)
		
		user_data = requests.get(
			f'{base_url}/v2/me',
			headers={'Authorization': f'Bearer {access_token}'},
			timeout=10
		)
		if user_data.status_code != 200:
			return Response({'error': 'Failed to fetch user data'}, status=status.HTTP_400_BAD_REQUEST)

		user_42 = user_data.json()
		if not user_42:
			return Response({'error': 'Failed to fetch user data'}, status=status.HTTP_400_BAD_REQUEST)
		
		login = user_42.get('login')
		email = user_42.get('email')

		if not login:
			return Response({"error": "Missing login in 42 payload"}, status=status.HTTP_400_BAD_REQUEST)

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

		cursus_users = user_42.get("cursus_users") or []
		if cursus_users and cursus_users[0].get("level") is not None:
			profile.intra_level = cursus_users[0].get("level")

		profile.save()

		refresh = RefreshToken.for_user(user)

		return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                },
                "profile_id": profile.id,
            },
            status=status.HTTP_200_OK,
        )

# Returns the authenticated user's profile information
class UserProfileView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		user = request.user
		profile = getattr(user, 'forty_two_profile', None)
		if not profile:
			return Response({'error': 'Profile not found'}, status=status.HTTP_404_NOT_FOUND)

		data = {
			'intra_id': profile.intra_id,
			'intra_level': profile.intra_level,
			'intra_wallet': profile.intra_wallet,
			'login': profile.login,
			'display_name': profile.display_name,
			'email': profile.email,
			'avatar_url': profile.avatar_url,
			'coalition': profile.coalition,
		}
		return Response(data, status=status.HTTP_200_OK)


class AuthTokenRefreshView(TokenRefreshView):
	permission_classes = [AllowAny]


class AuthLogoutView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request):
		# JWT is stateless here; frontend must discard access/refresh tokens.
		return Response({'detail': 'Logout successful. Remove tokens client-side.'}, status=status.HTTP_200_OK)