from django.urls import path

from .views import MatchDetailView, MatchListView, MatchMoveView, MatchRematchView


urlpatterns = [
	path('matches/', MatchListView.as_view(), name='game-match-list'),
	path('matches/<int:match_id>/', MatchDetailView.as_view(), name='game-match-detail'),
	path('matches/<int:match_id>/move/', MatchMoveView.as_view(), name='game-match-move'),
	path('matches/<int:match_id>/rematch/', MatchRematchView.as_view(), name='game-match-rematch'),
]
