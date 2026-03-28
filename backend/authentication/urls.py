from django.urls import path
from .views import (
	AuthLogoutView,
	AuthTokenRefreshView,
	OAuth42CallbackView,
	OAuth42LoginUrlView,
	OAuth42LoginView,
	UserProfileView,
)

urlpatterns = [
	path('42/login-url/', OAuth42LoginUrlView.as_view(), name='oauth42-login-url'),
	path('42/login/', OAuth42LoginView.as_view(), name='oauth42-login'),
	path('42/callback/', OAuth42CallbackView.as_view(), name='oauth42-callback'),
	path('profile/', UserProfileView.as_view(), name='user-profile'),
	path('token/refresh/', AuthTokenRefreshView.as_view(), name='token-refresh'),
	path('logout/', AuthLogoutView.as_view(), name='auth-logout'),
]
