from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import (
	get_pending_achievement_events_for_user,
	_serialize_user_details,
	FriendsRequestError,
	accept_friend_request,
	get_achievements_payload_for_user,
	get_or_create_friends_payload_for_user,
	get_pending_friend_requests_payload_for_user,
	remove_friend,
	reject_friend_request,
	send_friend_request,
	withdraw_friend_request,
)

class UserDetailView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		user_login = request.query_params.get('login')

		if not user_login:
			return Response(
				{'error': 'User login is required'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		user_details = _serialize_user_details(user_login)

		if user_details is None:
			return Response(
				{'error': 'User not found'},
				status=status.HTTP_404_NOT_FOUND,
			)
		
		return Response(user_details, status=status.HTTP_200_OK)


class FriendsMeView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		payload = get_or_create_friends_payload_for_user(request.user)
		return Response(payload, status=status.HTTP_200_OK)


class FriendsRequestView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request):
		to_login = request.data.get('login')

		try:
			send_friend_request(request.user, to_login)
		except FriendsRequestError as error:
			return Response({'error': error.message}, status=error.http_status)

		payload = get_or_create_friends_payload_for_user(request.user)
		return Response({'detail': 'Friend request sent', 'friends': payload}, status=status.HTTP_201_CREATED)

	def patch(self, request):
		from_login = request.data.get('login')
		action = (request.data.get('action') or '').lower()

		if action not in ['accept', 'reject']:
			return Response({'error': 'Action must be accept or reject'}, status=status.HTTP_400_BAD_REQUEST)

		try:
			if action == 'accept':
				accept_friend_request(request.user, from_login)
				detail = 'Friend request accepted'
			else:
				reject_friend_request(request.user, from_login)
				detail = 'Friend request rejected'
		except FriendsRequestError as error:
			return Response({'error': error.message}, status=error.http_status)

		payload = get_or_create_friends_payload_for_user(request.user)
		return Response({'detail': detail, 'friends': payload}, status=status.HTTP_200_OK)

	def delete(self, request):
		to_login = request.data.get('login')

		try:
			withdraw_friend_request(request.user, to_login)
		except FriendsRequestError as error:
			return Response({'error': error.message}, status=error.http_status)

		payload = get_or_create_friends_payload_for_user(request.user)
		return Response({'detail': 'Friend request withdrawn', 'friends': payload}, status=status.HTTP_200_OK)


class FriendsPendingView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		payload = get_pending_friend_requests_payload_for_user(request.user)
		return Response(payload, status=status.HTTP_200_OK)


class FriendsRelationView(APIView):
	permission_classes = [IsAuthenticated]

	def delete(self, request):
		friend_login = request.data.get('login')

		try:
			remove_friend(request.user, friend_login)
		except FriendsRequestError as error:
			return Response({'error': error.message}, status=error.http_status)

		payload = get_or_create_friends_payload_for_user(request.user)
		return Response({'detail': 'Friend removed', 'friends': payload}, status=status.HTTP_200_OK)

class AchievementsView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		payload = get_achievements_payload_for_user(request.user)
		return Response(payload, status=status.HTTP_200_OK)


class AchievementEventsView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		payload = get_pending_achievement_events_for_user(request.user)
		return Response(payload, status=status.HTTP_200_OK)