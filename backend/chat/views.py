from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import get_conversations_for_user, get_messages_between


def _resolve_my_login(request):
	campus_user = getattr(request.user, 'campus_user_profile', None)
	return getattr(campus_user, 'login', None) or request.user.username


class ConversationsListView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		my_login = _resolve_my_login(request)
		conversations = get_conversations_for_user(my_login)
		return Response({'conversations': conversations}, status=status.HTTP_200_OK)


class MessagesView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request, other_login: str):
		my_login = _resolve_my_login(request)

		messages = get_messages_between(my_login, other_login)
		if messages is None:
			return Response({'error': 'Conversation not found'}, status=status.HTTP_404_NOT_FOUND)

		return Response({'messages': messages}, status=status.HTTP_200_OK)