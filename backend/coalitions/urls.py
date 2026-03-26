from django.urls import path

from .views import CoalitionLeaderboardView


urlpatterns = [
	path('leaderboard/', CoalitionLeaderboardView.as_view(), name='coalition-leaderboard'),
]
