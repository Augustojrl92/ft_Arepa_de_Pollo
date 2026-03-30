from django.urls import path

from .views import CoalitionLeaderboardView, CoalitionSimpleView, UserRankingView


urlpatterns = [
	path('', CoalitionSimpleView.as_view(), name='coalition-simple'),
	path('leaderboard/', CoalitionLeaderboardView.as_view(), name='coalition-leaderboard'),
	path('users-ranking/', UserRankingView.as_view(), name='user-ranking'),
]
