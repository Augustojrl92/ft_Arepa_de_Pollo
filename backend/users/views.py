import json
import logging

from time import time

from django.http import HttpResponse
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from authentication.permissions import IsStudentOrAdmin

from sync.models import CampusUser

from .models import UserPreferences
from .services import (
	_serialize_user_details,
	_serialize_user_points_history,
	build_user_gdpr_export,
	FriendsRequestError,
	accept_friend_request,
	delete_user_account,
	get_or_create_friends_payload_for_user,
	get_pending_friend_requests_payload_for_user,
	remove_friend,
	reject_friend_request,
	send_friend_request,
	search_users_for_friend_requests,
	send_gdpr_confirmation_email,
	withdraw_friend_request,
	get_achivements_for,
)
from .events import broadcast_friend_event


logger = logging.getLogger(__name__)

# Create your views here.

class UserDetailView(APIView):
	permission_classes = [IsStudentOrAdmin]

	def get(self, request):
		user_login = request.query_params.get('login')

		if not user_login:
			return Response(
				{'error': 'User login is required'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		user_details = _serialize_user_details(user_login, request=request)

		if user_details is None:
			return Response(
				{'error': 'User not found'},
				status=status.HTTP_404_NOT_FOUND,
			)
		
		return Response(user_details, status=status.HTTP_200_OK)


class UserPointsHistoryView(APIView):
	permission_classes = [IsStudentOrAdmin]

	def get(self, request):
		user_login = request.query_params.get('login')

		if not user_login:
			return Response(
				{'error': 'User login is required'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		payload = _serialize_user_points_history(user_login)
		if payload is None:
			return Response(
				{'error': 'User not found'},
				status=status.HTTP_404_NOT_FOUND,
			)

		return Response(payload, status=status.HTTP_200_OK)


class FriendsMeView(APIView):
	permission_classes = [IsStudentOrAdmin]

	def get(self, request):
		payload = get_or_create_friends_payload_for_user(request.user, request=request)
		return Response(payload, status=status.HTTP_200_OK)


class UserHeartbeatView(APIView):
	permission_classes = [IsStudentOrAdmin]

	def post(self, request):
		user = request.user
		payload_login = (request.data.get('login') or '').strip()
		login_candidates = []

		if payload_login:
			login_candidates.append(payload_login)

		campus_user = getattr(user, 'campus_user_profile', None)
		if campus_user and getattr(campus_user, 'login', None):
			login_candidates.append(campus_user.login)
		login_candidates.append(user.username)

		for candidate in login_candidates:
			if not candidate:
				continue
			campus_user = CampusUser.objects.filter(login=candidate).first()
			if campus_user is not None:
				campus_user.last_active_time = int(time())
				campus_user.save(update_fields=['last_active_time'])
				break

		return Response({'ok': True}, status=status.HTTP_200_OK)


class FriendsRequestView(APIView):
	permission_classes = [IsStudentOrAdmin]

	def get(self, request):
		query = request.query_params.get('q', '')
		results = search_users_for_friend_requests(request.user, query)
		return Response({'results': results}, status=status.HTTP_200_OK)

	def post(self, request):
		to_login = request.data.get('login')

		try:
			to_user = send_friend_request(request.user, to_login)
		except FriendsRequestError as error:
			return Response({'error': error.message}, status=error.http_status)

		broadcast_friend_event([request.user, to_user], 'friend.request.created', request.user)
		payload = get_or_create_friends_payload_for_user(request.user, request=request)
		return Response({'detail': 'Friend request sent', 'friends': payload}, status=status.HTTP_201_CREATED)

	def patch(self, request):
		from_login = request.data.get('login')
		action = (request.data.get('action') or '').lower()

		if action not in ['accept', 'reject']:
			return Response({'error': 'Action must be accept or reject'}, status=status.HTTP_400_BAD_REQUEST)

		try:
			if action == 'accept':
				from_user = accept_friend_request(request.user, from_login)
				detail = 'Friend request accepted'
			else:
				from_user = reject_friend_request(request.user, from_login)
				detail = 'Friend request rejected'
		except FriendsRequestError as error:
			return Response({'error': error.message}, status=error.http_status)

		event_name = 'friend.request.accepted' if action == 'accept' else 'friend.request.rejected'
		broadcast_friend_event([request.user, from_user], event_name, request.user)
		payload = get_or_create_friends_payload_for_user(request.user, request=request)
		return Response({'detail': detail, 'friends': payload}, status=status.HTTP_200_OK)

	def delete(self, request):
		to_login = request.data.get('login')

		try:
			to_user = withdraw_friend_request(request.user, to_login)
		except FriendsRequestError as error:
			return Response({'error': error.message}, status=error.http_status)

		broadcast_friend_event([request.user, to_user], 'friend.request.withdrawn', request.user)
		payload = get_or_create_friends_payload_for_user(request.user, request=request)
		return Response({'detail': 'Friend request withdrawn', 'friends': payload}, status=status.HTTP_200_OK)


class FriendsPendingView(APIView):
	permission_classes = [IsStudentOrAdmin]

	def get(self, request):
		payload = get_pending_friend_requests_payload_for_user(request.user, request=request)
		return Response(payload, status=status.HTTP_200_OK)


class FriendsRelationView(APIView):
	permission_classes = [IsStudentOrAdmin]

	def delete(self, request):
		friend_login = request.data.get('login')

		try:
			friend_user = remove_friend(request.user, friend_login)
		except FriendsRequestError as error:
			return Response({'error': error.message}, status=error.http_status)

		broadcast_friend_event([request.user, friend_user], 'friend.removed', request.user)
		payload = get_or_create_friends_payload_for_user(request.user, request=request)
		return Response({'detail': 'Friend removed', 'friends': payload}, status=status.HTTP_200_OK)


class UserPreferencesView(APIView):
	permission_classes = [IsStudentOrAdmin]

	VALID_ITEMS_PER_PAGE = {10, 25, 50, 100}
	VALID_THEME_MODES = {'light', 'dark', 'system'}

	def _parse_bool(self, value, field_name):
		if isinstance(value, bool):
			return value

		if isinstance(value, str):
			normalized = value.strip().lower()
			if normalized in {'true', '1', 'yes', 'on'}:
				return True
			if normalized in {'false', '0', 'no', 'off'}:
				return False

		raise ValueError(f'{field_name} must be a boolean')

	def _serialize_preferences(self, request, preferences):
		campus_user = getattr(request.user, 'campus_user_profile', None)
		fallback_avatar_url = campus_user.avatar_url if campus_user else ''

		if preferences.custom_avatar:
			avatar_url = request.build_absolute_uri(preferences.custom_avatar.url)
			has_custom_avatar = True
		else:
			avatar_url = fallback_avatar_url
			has_custom_avatar = False

		return {
			'items_per_page': preferences.items_per_page,
			'show_sensitive_data': preferences.show_sensitive_data,
			'theme_mode': preferences.theme_mode,
			'receive_notifications': preferences.receive_notifications,
			'custom_username': preferences.custom_username,
			'avatar_url': avatar_url,
			'has_custom_avatar': has_custom_avatar,
		}

	def get(self, request):
		preferences, _created = UserPreferences.objects.get_or_create(user=request.user)
		return Response(self._serialize_preferences(request, preferences), status=status.HTTP_200_OK)

	def patch(self, request):
		preferences, _created = UserPreferences.objects.get_or_create(user=request.user)
		data = request.data

		updates = {}
		if 'items_per_page' in data:
			try:
				items_per_page = int(data.get('items_per_page'))
			except (TypeError, ValueError):
				return Response({'error': 'items_per_page must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

			if items_per_page not in self.VALID_ITEMS_PER_PAGE:
				return Response({'error': 'items_per_page must be one of 10, 25, 50, 100'}, status=status.HTTP_400_BAD_REQUEST)

			updates['items_per_page'] = items_per_page

		if 'show_sensitive_data' in data:
			try:
				updates['show_sensitive_data'] = self._parse_bool(data.get('show_sensitive_data'), 'show_sensitive_data')
			except ValueError as error:
				return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)

		if 'theme_mode' in data:
			theme_mode = str(data.get('theme_mode') or '').strip().lower()
			if theme_mode not in self.VALID_THEME_MODES:
				return Response({'error': 'theme_mode must be one of light, dark, system'}, status=status.HTTP_400_BAD_REQUEST)
			updates['theme_mode'] = theme_mode

		if 'receive_notifications' in data:
			try:
				updates['receive_notifications'] = self._parse_bool(data.get('receive_notifications'), 'receive_notifications')
			except ValueError as error:
				return Response({'error': str(error)}, status=status.HTTP_400_BAD_REQUEST)

		if 'custom_username' in data:
			custom_username = data.get('custom_username')
			updates['custom_username'] = custom_username or None

		if not updates:
			return Response({'error': 'No valid preference fields provided'}, status=status.HTTP_400_BAD_REQUEST)

		for field, value in updates.items():
			setattr(preferences, field, value)

		preferences.save(update_fields=list(updates.keys()))
		return Response(self._serialize_preferences(request, preferences), status=status.HTTP_200_OK)


class UserMeExportView(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request):
		payload = build_user_gdpr_export(request.user, request=request)

		filename = f"aedlph-data-export-{request.user.username}.json"
		response = HttpResponse(
			json.dumps(payload, ensure_ascii=False, indent=2),
			content_type='application/json; charset=utf-8',
		)
		response['Content-Disposition'] = f'attachment; filename="{filename}"'
		return response


class UserMeAccountView(APIView):
	permission_classes = [IsAuthenticated]

	def delete(self, request):
		user = request.user
		delete_user_account(user)
		return Response(
			{'detail': 'Account deleted successfully'},
			status=status.HTTP_200_OK,
		)


class UserAvatarView(APIView):
	permission_classes = [IsStudentOrAdmin]
	parser_classes = [MultiPartParser, FormParser]

	MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024
	ALLOWED_CONTENT_TYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}

	def put(self, request):
		avatar = request.FILES.get('avatar') or request.FILES.get('custom_avatar')

		if avatar is None:
			return Response({'error': 'Avatar file is required (avatar)'}, status=status.HTTP_400_BAD_REQUEST)

		if avatar.content_type not in self.ALLOWED_CONTENT_TYPES:
			return Response(
				{'error': 'Unsupported image type. Allowed: image/jpeg, image/png, image/webp, image/gif'},
				status=status.HTTP_400_BAD_REQUEST,
			)

		if avatar.size > self.MAX_AVATAR_SIZE_BYTES:
			return Response({'error': 'Avatar exceeds 2MB size limit'}, status=status.HTTP_400_BAD_REQUEST)

		preferences, _created = UserPreferences.objects.get_or_create(user=request.user)

		if preferences.custom_avatar:
			preferences.custom_avatar.delete(save=False)

		preferences.custom_avatar = avatar
		preferences.save(update_fields=['custom_avatar'])

		avatar_url = request.build_absolute_uri(preferences.custom_avatar.url)
		return Response({'avatar_url': avatar_url, 'has_custom_avatar': True}, status=status.HTTP_200_OK)

	def delete(self, request):
		preferences, _created = UserPreferences.objects.get_or_create(user=request.user)
		if preferences.custom_avatar:
			preferences.custom_avatar.delete(save=False)
			preferences.custom_avatar = None
			preferences.save(update_fields=['custom_avatar'])

		campus_user = getattr(request.user, 'campus_user_profile', None)
		fallback_avatar_url = campus_user.avatar_url if campus_user else ''

		return Response(
			{
				'detail': 'Custom avatar removed',
				'avatar_url': fallback_avatar_url,
				'has_custom_avatar': False,
			},
			status=status.HTTP_200_OK,
		)
	
class UserAchievementsView(APIView):
	# Was relying on the global default, which only requires authentication and
	# would therefore have been readable by guests.
	permission_classes = [IsStudentOrAdmin]

	def get(self, req, login: str):
		if not login:
			return Response(
				{'error': 'User login is required'},
				status=status.HTTP_400_BAD_REQUEST,
			)
		
		achvs = get_achivements_for(login)
		if achvs == None:
			return Response(
				{'error': 'User not found or no achievements'},
				status=status.HTTP_404_NOT_FOUND
			)
		
		serialized = []
		for achv in achvs:
			completion_date = achv.completion_date
			if completion_date != None:
				completion_date = completion_date.isoformat()
			serialized.append({
				'name': achv.achievement.name,
				'description': achv.achievement.description,
				'progress': achv.progress, 
				'completion_progress': achv.achievement.completion_points,
				'completion_date': completion_date,
				'icon_HTML': achv.achievement.icon_HTML
			})
		
		return Response(
			{
				'login': login,
				'n_achievements': len(achvs),
				'achievements': serialized
			},
			status=status.HTTP_200_OK
		)
