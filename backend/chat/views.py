
from rest_framework.views import APIView
from django.shortcuts import render

from services import get_messages_between

# Create your views here.
class MessagesView(APIView):
	def get(self, req, other_login: str):
		pass
