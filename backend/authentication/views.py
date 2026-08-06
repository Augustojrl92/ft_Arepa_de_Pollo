import logging
import os
import secrets
from datetime import datetime, timedelta

import requests
from requests import RequestException
from urllib.parse import urlencode
from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import User, update_last_login
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.shortcuts import redirect
from django.utils import timezone
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer

from coalitions.services import _get_sync_user_ranks, _serialize_simple_coalitions
from sync.models import CampusUser
from users.models import UserPreferences

from .emails import (
	send_account_deleted_email,
	send_existing_account_email,
	send_password_reset_email,
	send_verification_email,
)
from .serializers import (
	LoginSerializer,
	PasswordResetConfirmSerializer,
	PasswordResetRequestSerializer,
	RegisterSerializer,
	SetPasswordSerializer,
	VerifyEmailSerializer,
)

from .permissions import role_for
from .tokens import email_verification_token_generator

logger = logging.getLogger(__name__)

# Create your views here.

# How long a completed 42 authorisation stays usable for finishing a signup.
REGISTRATION_GRANT_TTL_SECONDS = 10 * 60


def _build_42_authorize_url(request, purpose='login'):
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
	# Remembered so the callback knows whether this round trip was a sign-in or
	# the identity check that gates a signup.
	request.session['oauth42_purpose'] = purpose

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

def _blacklist_refresh_token(raw_token):
	"""Revoke a single refresh token. Silently ignores one already invalid."""
	if not raw_token:
		return

	try:
		RefreshToken(raw_token).blacklist()
	except TokenError:
		pass

def _blacklist_all_sessions_for(user):
	"""Revoke every outstanding refresh token belonging to `user`.

	Used after a password change so sessions opened with the old password —
	including ones on other devices — cannot be refreshed any further.
	"""
	for outstanding in OutstandingToken.objects.filter(user=user):
		BlacklistedToken.objects.get_or_create(token=outstanding)

def _upsert_campus_user_from_42_payload(user, user_42):
	intra_id = user_42.get('id')
	if intra_id is None:
		return None

	user_payload = user_42 or {}
	image_payload = user_payload.get('image') or {}
	now = timezone.now()

	campus_user, _created = CampusUser.objects.get_or_create(
		intra_id=intra_id,
		defaults={
			'django_user': user,
			'user_id': intra_id,
			'grade': '',
			'level': 0,
			'login': user_payload.get('login') or user.username,
			'email': user_payload.get('email') or user.email or '',
			'display_name': user_payload.get('displayname') or user.username,
			'avatar_url': image_payload.get('link') or '',
			'wallet': user_payload.get('wallet') or 0,
			'correction_points': user_payload.get('correction_point') or 0,
			'pool_month': user_payload.get('pool_month') or '',
			'pool_year': None,
			'is_active': True,
			'coalition_id': None,
			'coalition_name': '',
			'coalition_slug': '',
			'coalition_user_score': 0,
			'created_at': now,
			'updated_at': now,
		},
	)

	campus_user.django_user = user
	campus_user.user_id = intra_id
	campus_user.login = user_payload.get('login') or campus_user.login
	campus_user.email = user_payload.get('email') or campus_user.email
	campus_user.display_name = user_payload.get('displayname') or campus_user.display_name
	campus_user.avatar_url = image_payload.get('link') or campus_user.avatar_url
	campus_user.wallet = user_payload.get('wallet') or 0
	campus_user.correction_points = user_payload.get('correction_point') or 0
	campus_user.updated_at = now

	cursus_users = user_payload.get('cursus_users') or []
	selected_cursus = next(
		(
			cursus_user
			for cursus_user in cursus_users
			if ((cursus_user.get('cursus') or {}).get('name') or '').lower() == '42cursus'
		),
		None,
	)
	if selected_cursus and selected_cursus.get('level') is not None:
		campus_user.level = selected_cursus.get('level')

	campus_user.save()
	return campus_user

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


# Upgrades a guest account: sends the signed-in user through 42 so their campus
# identity can be attached. This is an entitlement step, not a login.
class OAuth42LinkView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		auth_url, _state, error_response = _build_42_authorize_url(request, purpose='link')
		if error_response:
			return error_response
		request.session['link_user_id'] = request.user.pk
		return redirect(auth_url)


# Handles the callback from 42 OAuth and creates/updates the user and profile
class OAuth42CallbackView(APIView):
	permission_classes = [AllowAny]

	def get(self, request):
		frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000').rstrip('/')

		def _redirect_with_error(message):
			# Without this the only trace of a failed login is a bare 302 in the
			# access log, which says nothing about which check rejected it.
			logger.warning('42 OAuth callback rejected: %s', message)
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

		campuses = user_42.get('campus', [])
		madrid_campus = next((c for c in campuses if c.get('id') == 22), None)

		if not madrid_campus:
			return _redirect_with_error('not_in_madrid_campus')

		purpose = request.session.pop('oauth42_purpose', 'login')

		def _redirect_link_error(message):
			# A failed link leaves the guest signed in, so send them back to their
			# own screen rather than to /login, which would look like a logout.
			logger.warning('42 link rejected: %s', message)
			return redirect(f"{frontend_url}/guest?{urlencode({'error': message})}")

		if purpose == 'link':
			# Attaching a campus identity to the guest account that started this.
			link_user_id = request.session.pop('link_user_id', None)
			target = User.objects.filter(pk=link_user_id).first() if link_user_id else None

			if target is None:
				return _redirect_link_error('link_session_expired')

			claimed = CampusUser.objects.filter(login=login).exclude(django_user=None).first()
			if claimed is not None and claimed.django_user_id != target.pk:
				return _redirect_link_error('campus_identity_already_linked')

			if User.objects.filter(username=login).exclude(pk=target.pk).exists():
				return _redirect_link_error('campus_identity_already_linked')

			# The rest of the app keys off username, so adopt the 42 login now
			# that it is proven. Guests are stored under their email, which can
			# never collide with a login because it contains "@".
			target.username = login
			target.save(update_fields=['username'])

			_upsert_campus_user_from_42_payload(target, user_42)
			logger.info('Linked campus identity %s to account %s', login, target.pk)
			return redirect(f"{frontend_url}/?linked=1")

		user, _created = User.objects.get_or_create(
            username=login,
            defaults={"email": email},
        )

		updated_fields = []

		if email and not user.email:
			user.email = email
			updated_fields.append("email")

		# A successful 42 callback proves the person controls this identity, so
		# an account registered but never verified by email is activated here.
		if not user.is_active:
			user.is_active = True
			updated_fields.append("is_active")

			user.set_unusable_password()
			if "password" not in updated_fields:
				updated_fields.append("password")

		# get_or_create leaves password='', which Django reports as a *usable*
		# password even though nothing can match it. Record the absence
		# explicitly so "has this account got a password?" has a truthful answer.
		if not user.password:
			user.set_unusable_password()
			if "password" not in updated_fields:
				updated_fields.append("password")

		if updated_fields:
			user.save(update_fields=updated_fields)

		_upsert_campus_user_from_42_payload(user, user_42)

		refresh = RefreshToken.for_user(user)
		response = redirect(f"{frontend_url}/?auth=1")
		_set_auth_cookies(response, refresh)
		return response

# Returns the authenticated user's profile information
class UserProfileView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		user = request.user
		campus_user = CampusUser.objects.filter(django_user=user).first()

		if campus_user is None:
			# A guest: the account exists but no campus identity is attached, so
			# there is no campus data to report. Returning a shell rather than a
			# 404 lets the frontend render the "link your 42 account" state
			# instead of treating the session as broken.
			return Response(
				{
					'user_id': user.id,
					'username': user.username,
					'email': user.email,
					'role': role_for(user),
					'display_name': user.email,
				},
				status=status.HTTP_200_OK,
			)

		campus_rank = _get_sync_user_ranks(campus_user)
		coalition_summary = _serialize_simple_coalitions(campus_user.coalition_slug) if campus_user.coalition_slug else None
		preferences = UserPreferences.objects.filter(user=user).first()

		if preferences and preferences.custom_avatar:
			avatar_url = request.build_absolute_uri(preferences.custom_avatar.url)
			has_custom_avatar = True
		else:
			avatar_url = campus_user.avatar_url
			has_custom_avatar = False

		data = {
			'user_id': user.id,
			'username': user.username,
			'intra_id': campus_user.intra_id,
			'intra_level': campus_user.level,
			'intra_wallet': campus_user.wallet,
			'eval_points': campus_user.correction_points,
			'login': campus_user.login,
			'display_name': campus_user.display_name,
			'email': campus_user.email or user.email,
			'avatar_url': avatar_url,
			'has_custom_avatar': has_custom_avatar,
			'coalition': campus_user.coalition_slug or None,
			'coalition_points': campus_user.coalition_user_score,
			'coalition_user_rank': campus_user.coalition_rank,
			'campus_user_rank': campus_rank,
			'role': role_for(user),
		}
		return Response(data, status=status.HTTP_200_OK)

class AuthTokenRefreshView(APIView):
	permission_classes = [AllowAny]

	def post(self, request):
		refresh_token = request.data.get('refresh') or request.COOKIES.get('refresh_token')

		if not refresh_token:
			return Response({'refreshed': False, 'error': 'Refresh token not provided'}, status=status.HTTP_200_OK)

		serializer = TokenRefreshSerializer(data={'refresh': refresh_token})

		# TokenRefreshSerializer raises TokenError (not a DRF ValidationError)
		# for expired, malformed or blacklisted tokens, so is_valid() would let
		# it escape as a 500 instead of a handled failure.
		try:
			is_valid = serializer.is_valid()
		except TokenError:
			is_valid = False

		if not is_valid:
			# Always 200: an expired/blacklisted refresh token is an expected
			# outcome (the session ended), not a server error. Callers read the
			# `refreshed` field instead of the HTTP status, which keeps this
			# from showing up as a failed request in the browser console.
			response = Response({'refreshed': False, 'error': 'Invalid refresh token'}, status=status.HTTP_200_OK)
			_clear_auth_cookies(response)
			return response

		validated = serializer.validated_data
		response = Response({'refreshed': True}, status=status.HTTP_200_OK)

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
		# Clearing cookies only ends the session in this browser; blacklisting
		# the refresh token is what actually revokes it server side.
		_blacklist_refresh_token(request.data.get('refresh') or request.COOKIES.get('refresh_token'))

		response = Response({'detail': 'Logout successful'}, status=status.HTTP_200_OK)
		_clear_auth_cookies(response)
		return response


# Registration answers identically whether or not the address is eligible, so
# the endpoint cannot be used to enumerate the campus roster.
GENERIC_REGISTER_DETAIL = 'If your email is eligible, you will receive a verification link shortly.'
REGISTERED_EMAIL_ERROR = 'Este correo ya está registrado. Inicia sesión o recupera tu contraseña.'
GENERIC_RESET_DETAIL = 'If an account exists for that email, you will receive a reset link shortly.'
INVALID_CREDENTIALS_DETAIL = 'Invalid email or password'

_DUMMY_PASSWORD_HASH = None


def _dummy_password_hash():
	"""Hash used to keep failed logins for unknown emails as slow as real ones."""
	global _DUMMY_PASSWORD_HASH
	if _DUMMY_PASSWORD_HASH is None:
		_DUMMY_PASSWORD_HASH = make_password('timing-equalizer-not-a-real-password')
	return _DUMMY_PASSWORD_HASH


def _resolve_registration_campus_user(email):
	"""Find the campus identity an email is allowed to register as.

	Returns (campus_user, invite). Both are None when the address is not
	eligible. Every eligible path resolves to a `CampusUser`, so an account
	created here always has a complete profile rather than an empty shell.
	"""
	campus_user = CampusUser.objects.filter(email__iexact=email).first()
	if campus_user is not None:
		return campus_user, None

	invite = RegistrationInvite.objects.filter(email__iexact=email, used_at__isnull=True).first()
	if invite is not None:
		return CampusUser.objects.filter(login=invite.campus_login).first(), invite

	return None, None


def _user_from_uidb64(uidb64):
	try:
		pk = force_str(urlsafe_base64_decode(uidb64))
		return User.objects.get(pk=pk)
	except (TypeError, ValueError, OverflowError, User.DoesNotExist):
		return None


class RegisterView(APIView):
	"""Create a guest account from an email and a password. 42 is not involved.

	The account this produces can reach nothing: it exists, it can sign in, and
	from there it can either attach a 42 identity or delete itself. That is why
	registering with somebody else's address is harmless — confirming an email
	proves control of a mailbox, which entitles you to a guest account and
	nothing more.
	"""

	permission_classes = [AllowAny]
	throttle_scope = 'auth_register'

	def post(self, request):
		serializer = RegisterSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		email = serializer.validated_data['email']
		password = serializer.validated_data['password']
		generic = Response({'detail': GENERIC_REGISTER_DETAIL}, status=status.HTTP_202_ACCEPTED)

		existing = User.objects.filter(email__iexact=email).first()
		if existing is not None:
			# Never modify an existing account from an unauthenticated endpoint.
			logger.info('Registration attempted for existing account %s', existing.pk)
			return Response({'error': REGISTERED_EMAIL_ERROR}, status=status.HTTP_409_CONFLICT)

		with transaction.atomic():
			# Stored under the email: it contains "@", so it can never collide
			# with a 42 login. Linking later renames it to the real login.
			user = User(username=email, email=email, is_active=False)
			user.set_password(password)
			user.save()

			# Inside the transaction so an undeliverable link rolls the account
			# back instead of stranding an unconfirmable one.
			send_verification_email(user)

		logger.info('Guest registration pending confirmation for %s', email)
		return generic


class VerifyEmailView(APIView):
	permission_classes = [AllowAny]
	throttle_scope = 'auth_verify_email'

	def post(self, request):
		serializer = VerifyEmailSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		user = _user_from_uidb64(serializer.validated_data['uid'])
		token = serializer.validated_data['token']

		if user is None or not email_verification_token_generator.check_token(user, token):
			return Response(
				{'error': 'This confirmation link is invalid or has expired.'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		user.is_active = True
		user.save(update_fields=['is_active'])

		refresh = RefreshToken.for_user(user)
		update_last_login(None, user)

		response = Response({'detail': 'Email confirmed'}, status=status.HTTP_200_OK)
		_set_auth_cookies(response, refresh)
		return response


class AccountDeleteView(APIView):
	"""Delete your own account. Deliberately available to guests.

	A guest can do exactly two things, and this is one of them; someone who
	registered by mistake must not be stuck with an account they cannot remove.
	"""

	permission_classes = [IsAuthenticated]

	def delete(self, request):
		user = request.user
		# Captured before the row goes: there is nothing to read them from after.
		recipient = user.email
		label = user.username
		logger.info('Account %s deleted by its owner', user.pk)

		with transaction.atomic():
			CampusUser.objects.filter(django_user=user).update(django_user=None)
			_blacklist_all_sessions_for(user)
			user.delete()

		# Sent after the delete has committed, and never allowed to undo it: the
		# owner asked for the account to go, so a mail failure must not resurrect
		# it. Unlike registration, where an undeliverable link would strand an
		# unusable account, here the operation is already complete and correct.
		if recipient:
			try:
				send_account_deleted_email(recipient, label)
			except Exception:
				logger.exception('Account %s deleted but the confirmation email failed', label)

		response = Response(status=status.HTTP_204_NO_CONTENT)
		_clear_auth_cookies(response)
		return response


class EmailLoginView(APIView):
	permission_classes = [AllowAny]
	throttle_scope = 'auth_login'

	def post(self, request):
		serializer = LoginSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		email = serializer.validated_data['email']
		password = serializer.validated_data['password']
		invalid = Response({'error': INVALID_CREDENTIALS_DETAIL}, status=status.HTTP_401_UNAUTHORIZED)

		user = User.objects.filter(email__iexact=email).first()

		if user is None:
			# Hash anyway so an unknown email is not measurably faster to reject
			# than a wrong password.
			check_password(password, _dummy_password_hash())
			return invalid

		if not user.check_password(password):
			return invalid

		if not user.is_active:
			return Response(
				{'error': 'Confirm your email address before signing in.', 'code': 'email_not_verified'},
				status=status.HTTP_403_FORBIDDEN,
			)

		refresh = RefreshToken.for_user(user)
		update_last_login(None, user)

		response = Response({'detail': 'Login successful'}, status=status.HTTP_200_OK)
		_set_auth_cookies(response, refresh)
		return response


class PasswordSetView(APIView):
	"""Add or change the password of the signed-in account.

	Accounts created through 42 start without one; this is how they gain a
	second way in without needing 42 next time.
	"""

	permission_classes = [IsAuthenticated]

	def post(self, request):
		serializer = SetPasswordSerializer(data=request.data, context={'user': request.user})
		serializer.is_valid(raise_exception=True)

		request.user.set_password(serializer.validated_data['new_password'])
		request.user.save(update_fields=['password'])

		# Revoke every session opened with the old password, then issue fresh
		# cookies so the caller who just changed it stays signed in.
		_blacklist_all_sessions_for(request.user)
		refresh = RefreshToken.for_user(request.user)
		response = Response({'detail': 'Password updated'}, status=status.HTTP_200_OK)
		_set_auth_cookies(response, refresh)
		return response


class PasswordResetRequestView(APIView):
	permission_classes = [AllowAny]
	throttle_scope = 'auth_password_reset'

	def post(self, request):
		serializer = PasswordResetRequestSerializer(data=request.data)
		serializer.is_valid(raise_exception=True)

		email = serializer.validated_data['email']
		user = User.objects.filter(email__iexact=email, is_active=True).first()

		if user is not None and user.email:
			send_password_reset_email(user)

		return Response({'detail': GENERIC_RESET_DETAIL}, status=status.HTTP_202_ACCEPTED)


class PasswordResetConfirmView(APIView):
	permission_classes = [AllowAny]
	throttle_scope = 'auth_password_reset'

	def post(self, request):
		uid = request.data.get('uid')
		token = request.data.get('token')
		user = _user_from_uidb64(uid) if uid else None

		if user is None or not default_token_generator.check_token(user, token):
			return Response(
				{'error': 'This reset link is invalid or has expired.'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		serializer = PasswordResetConfirmSerializer(data=request.data, context={'user': user})
		serializer.is_valid(raise_exception=True)

		user.set_password(serializer.validated_data['new_password'])
		user.save(update_fields=['password'])

		# A reset is the recovery path for a possibly compromised account, so
		# every existing session is revoked before a new one is issued.
		_blacklist_all_sessions_for(user)
		refresh = RefreshToken.for_user(user)
		update_last_login(None, user)

		response = Response({'detail': 'Password updated'}, status=status.HTTP_200_OK)
		_set_auth_cookies(response, refresh)
		return response
