from django.urls import path

from .views import CoalitionLeaderboardView, CoalitionSimpleView


urlpatterns = [
	path('', CoalitionSimpleView.as_view(), name='coalition-simple'),
	path('leaderboard/', CoalitionLeaderboardView.as_view(), name='coalition-leaderboard'),
]
