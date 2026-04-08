from django.urls import path

from .views import FriendsMeView, FriendsPendingView, FriendsRelationView, FriendsRequestView, UserDetailView


urlpatterns = [
	path('details/', UserDetailView.as_view(), name='user-details'),
	path('friends/', FriendsRelationView.as_view(), name='friends-relation'),
	path('friends/me/', FriendsMeView.as_view(), name='friends-me'),
	path('friends/pending/', FriendsPendingView.as_view(), name='friends-pending'),
	path('friends/requests/', FriendsRequestView.as_view(), name='friends-requests'),
	# path('preferences/', UserPreferencesView.as_view(), name='user-preferences'),
]
