from django.contrib.auth import get_user_model
from django.db import transaction

from django.contrib.auth.models import User
from sync.models import CampusUser

from time import time

# Import the DRF JWT auth class so middleware can authenticate JWTs (cookie fallback)
from authentication.authentication import CookieJWTAuthentication


class OnlineStatusMiddleware:
	def __init__(self, get_response):
		self.get_response = get_response

	def __call__(self, request):
		user = None

		try:
			auth = CookieJWTAuthentication()
			auth_result = auth.authenticate(request)
			if auth_result is not None:
				jwt_user, _validated_token = auth_result
				if jwt_user and getattr(jwt_user, 'is_authenticated', False):
					user = jwt_user
					request.user = jwt_user
		except Exception as e:
			print(f"[online-status-middleware] Error authenticating user: {e}")

		if user and getattr(user, 'is_authenticated', False):
			campus_user = getattr(user, "campus_user_profile", None)
			login = getattr(campus_user, "login", None) or user.username

			campus_user = CampusUser.objects.filter(login=login).first()
			if campus_user:
				campus_user.last_active_time = int(time())
				campus_user.save(update_fields=['last_active_time'])

		response = self.get_response(request)

		return response
