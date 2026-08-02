from django.urls import path
from .views import MessagesView

urlpatterns = [
	path('messages/<str:other_login>/', MessagesView.as_view(), name='chat-messages'),
]