from django.urls import path
from .views import (
	AuthLogoutView,
	AuthTokenRefreshView,
	EmailLoginView,
	OAuth42CallbackView,
	OAuth42LoginUrlView,
	OAuth42LoginView,
	PasswordResetConfirmView,
	PasswordResetRequestView,
	PasswordSetView,
	AccountDeleteView,
	OAuth42LinkView,
	RegisterView,
	VerifyEmailView,
	UserProfileView,
)

urlpatterns = [
	# Email / password provider
	path('register/', RegisterView.as_view(), name='auth-register'),
	path('verify-email/', VerifyEmailView.as_view(), name='auth-verify-email'),
	path('account/', AccountDeleteView.as_view(), name='auth-account-delete'),
	path('login/', EmailLoginView.as_view(), name='auth-login'),
	path('password/set/', PasswordSetView.as_view(), name='auth-password-set'),
	path('password/reset/', PasswordResetRequestView.as_view(), name='auth-password-reset'),
	path('password/reset/confirm/', PasswordResetConfirmView.as_view(), name='auth-password-reset-confirm'),

	# 42 OAuth provider
	path('42/login-url/', OAuth42LoginUrlView.as_view(), name='oauth42-login-url'),
	path('42/login/', OAuth42LoginView.as_view(), name='oauth42-login'),
	path('42/link/', OAuth42LinkView.as_view(), name='oauth42-link'),
	path('42/callback/', OAuth42CallbackView.as_view(), name='oauth42-callback'),

	# Shared session endpoints
	path('profile/', UserProfileView.as_view(), name='user-profile'),
	path('token/refresh/', AuthTokenRefreshView.as_view(), name='token-refresh'),
	path('logout/', AuthLogoutView.as_view(), name='auth-logout'),
]
