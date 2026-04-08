from django.urls import path

from .views import AchievementEventsView, AchievementsView, FriendsMeView, FriendsPendingView, FriendsRelationView, FriendsRequestView, UserDetailView


urlpatterns = [
	# Profile details
	path('details/', UserDetailView.as_view(), name='user-details'),

	# Friends
	path('friends/', FriendsRelationView.as_view(), name='friends-relation'),
	path('friends/me/', FriendsMeView.as_view(), name='friends-me'),
	path('friends/pending/', FriendsPendingView.as_view(), name='friends-pending'),
	path('friends/requests/', FriendsRequestView.as_view(), name='friends-requests'),

	# Achievements
	path('achievements/', AchievementsView.as_view(), name='user-achievements'),
	path('achievements/events/', AchievementEventsView.as_view(), name='user-achievement-events'),

	# Preferences (to be implemented)
	# path('preferences/', UserPreferencesView.as_view(), name='user-preferences'),
]
