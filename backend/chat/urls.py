
from django.urls import path
from .views import MessagesView


urlpatterns = [
	path('details/', MessagesView.as_view(), name='user-details'),
]
