from http.cookies import CookieError, SimpleCookie

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


@database_sync_to_async
def _get_user_from_access_token(raw_token):
	if not raw_token:
		return AnonymousUser()

	authentication = JWTAuthentication()
	try:
		validated_token = authentication.get_validated_token(raw_token)
		return authentication.get_user(validated_token)
	except (InvalidToken, TokenError, AuthenticationFailed):
		return AnonymousUser()


def _access_token_from_headers(headers):
	for name, value in headers:
		if name.lower() != b'cookie':
			continue
		cookie = SimpleCookie()
		try:
			cookie.load(value.decode('latin1'))
		except CookieError:
			return None
		morsel = cookie.get('access_token')
		return morsel.value if morsel else None
	return None


class CookieJWTAuthMiddleware(BaseMiddleware):
	"""Authenticate WebSockets with the same HttpOnly JWT cookie as the API."""

	async def __call__(self, scope, receive, send):
		scope = dict(scope)
		raw_token = _access_token_from_headers(scope.get('headers', []))
		scope['user'] = await _get_user_from_access_token(raw_token)
		return await super().__call__(scope, receive, send)
