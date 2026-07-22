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
		# Django's AuthenticationMiddleware populates `request.user` from the session.
		# DRF authentication (JWT in cookies) runs later during view handling, so
		# `request.user` may be Anonymous here even if a valid JWT cookie is present.
		user = getattr(request, 'user', None)

		if not (user and getattr(user, 'is_authenticated', False)):
			# Try DRF JWT authentication (cookie or Authorization header)
			try:
				auth = CookieJWTAuthentication()
				auth_result = auth.authenticate(request)
				if auth_result is not None:
					user, validated_token = auth_result
					# attach authenticated user to the request for downstream middleware
					request.user = user
			except Exception:
				# Authentication failed or no token present — proceed as anonymous
				user = getattr(request, 'user', None)

		if getattr(request, 'user', None) and request.user.is_authenticated:
			user = request.user
			campus_user = getattr(user, "campus_user_profile", None)
			login = getattr(campus_user, "login", None) or user.username

			campus_user = CampusUser.objects.filter(login=login).first()
			if campus_user:
				campus_user.last_active_time = int(time())
				# Persist last_active_time without wrapping in transaction here
				campus_user.save(update_fields=['last_active_time'])

		response = self.get_response(request)

		return response
