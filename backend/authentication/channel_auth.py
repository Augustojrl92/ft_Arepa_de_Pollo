from http.cookies import SimpleCookie
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _get_user_from_validated_token(validated_token):
	try:
		return JWTAuthentication().get_user(validated_token)
	except Exception:
		return AnonymousUser()


def _extract_token_from_scope(scope):
	headers = dict(scope.get('headers') or [])
	cookie_header = headers.get(b'cookie')

	if cookie_header:
		cookie = SimpleCookie()
		cookie.load(cookie_header.decode())
		if 'access_token' in cookie:
			return cookie['access_token'].value

	query_params = parse_qs(scope.get('query_string', b'').decode())
	token_list = query_params.get('token')
	return token_list[0] if token_list else None


class JWTAuthMiddleware:
	def __init__(self, app):
		self.app = app

	async def __call__(self, scope, receive, send):
		scope = dict(scope)
		scope['user'] = AnonymousUser()

		raw_token = _extract_token_from_scope(scope)
		if raw_token:
			try:
				validated_token = AccessToken(raw_token)
				scope['user'] = await _get_user_from_validated_token(validated_token)
			except (InvalidToken, TokenError):
				scope['user'] = AnonymousUser()

		return await self.app(scope, receive, send)


def JWTAuthMiddlewareStack(app):
	return JWTAuthMiddleware(app)