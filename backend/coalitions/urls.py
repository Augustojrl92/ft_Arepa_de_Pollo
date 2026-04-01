from django.urls import path

from .views import CoalitionSimpleView, CoalitionSingleDetailView, UserRankingView


urlpatterns = [
	path('', CoalitionSimpleView.as_view(), name='coalition-simple'),
	path('users-ranking/', UserRankingView.as_view(), name='user-ranking'),
	path('details/', CoalitionSingleDetailView.as_view(), name='coalition-details'),
]
