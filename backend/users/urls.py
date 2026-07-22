from django.urls import path


from .views import (
	FriendsMeView,
	FriendsPendingView,
	FriendsRelationView,
	FriendsRequestView,
	UserAvatarView,
	UserDetailView,
	UserPointsHistoryView,
	UserPreferencesView,
  UserAchievementsView,
)

urlpatterns = [
	path('details/', UserDetailView.as_view(), name='user-details'),
	path('points-history/', UserPointsHistoryView.as_view(), name='user-points-history'),
	path('friends/', FriendsRelationView.as_view(), name='friends-relation'),
	path('friends/me/', FriendsMeView.as_view(), name='friends-me'),
	path('friends/pending/', FriendsPendingView.as_view(), name='friends-pending'),
	path('friends/requests/', FriendsRequestView.as_view(), name='friends-requests'),
	path('preferences/', UserPreferencesView.as_view(), name='user-preferences'),
	path('preferences/avatar/', UserAvatarView.as_view(), name='user-avatar'),
	path('achievements/<str:login>', UserAchievementsView.as_view(), name='user-achievements')
]
