from django.urls import path
from .views import ConversationsListView, MessagesView

urlpatterns = [
	path('conversations/', ConversationsListView.as_view(), name='chat-conversations'),
	path('messages/<str:other_login>/', MessagesView.as_view(), name='chat-messages'),
]