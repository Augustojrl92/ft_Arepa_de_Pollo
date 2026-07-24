from datetime import datetime
import json
import logging
from time import time

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from sync.models import CampusUser
from .models import FriendsList, Achievement, UserAchievement
from .achievement_functions import set_up_achievements

logger = logging.getLogger(__name__)

time_until_inactivity = 2 * 60

from sync.models import CampusUser
from .models import FriendsList, Achievement, UserAchievement, Message

class FriendsRequestError(Exception):
	def __init__(self, message, http_status):
		super().__init__(message)
		self.message = message
		self.http_status = http_status

def _build_avatar_url(request, custom_avatar_url):
	if not custom_avatar_url:
		return ''

	if request is None:
		return custom_avatar_url

	return request.build_absolute_uri(custom_avatar_url)


def _resolve_avatar_url(owner, fallback_avatar_url='', request=None):
	if owner is None:
		return fallback_avatar_url or ''

	preferences = getattr(owner, 'preferences', None)
	if preferences and preferences.custom_avatar:
		return _build_avatar_url(request, preferences.custom_avatar.url)

	return fallback_avatar_url or ''

def _serialize_user_details(user_login, request=None):
	campus_user = CampusUser.objects.filter(login=user_login).first()
	
	if campus_user is None:
		return None
	
	owner = campus_user.django_user or User.objects.filter(username=user_login).first()
	has_account = owner is not None
	avatar_url = _resolve_avatar_url(owner, campus_user.avatar_url, request=request)

	active = time() - campus_user.last_active_time < time_until_inactivity

	return {
		'id': campus_user.user_id,
		'login': campus_user.login,
		'display_name': campus_user.display_name,
		'avatar_url': avatar_url,
		'level': campus_user.level,
		'coalition_name': campus_user.coalition_name,
		'coalition_slug': campus_user.coalition_slug,
		'coalition_points': campus_user.coalition_user_score,
		'coalition_rank': campus_user.coalition_rank,
		'has_account': has_account,
		'general_rank': campus_user.general_rank,
		'achievements': 'none',  # Placeholder for achievements data,
		'active': active
	}


def _serialize_user_points_history(user_login):
	campus_user = CampusUser.objects.filter(login=user_login).first()
	if campus_user is None:
		return None

	history = list(
		campus_user.score_snapshots.order_by('snapshot_date').values(
			'snapshot_date',
			'coalition_user_score',
			'coalition_user_rank',
			'campus_user_rank',
		)
	)

	return {
		'user': {
			'id': campus_user.id,
			'login': campus_user.login,
			'display_name': campus_user.display_name,
			'coalition_slug': campus_user.coalition_slug,
		},
		'history': [
			{
				'date': item['snapshot_date'].isoformat(),
				'points': item['coalition_user_score'],
				'coalition_rank': item['coalition_user_rank'],
				'campus_rank': item['campus_user_rank'],
			}
			for item in history
		],
	}

def _serialize_friend_entry(friend_list, request=None):
	owner = friend_list.owner
	campus_user = getattr(owner, 'campus_user_profile', None)
	fallback_avatar_url = campus_user.avatar_url if campus_user else ''
	avatar_url = _resolve_avatar_url(owner, fallback_avatar_url, request=request)

	login = getattr(campus_user, 'login', None)
	last_active_time = getattr(campus_user, 'last_active_time', 0) if campus_user is not None else 0
	active = (time() - last_active_time) < time_until_inactivity if last_active_time else False

	return {
		'user_id': owner.id,
		'username': owner.username,
		'login': campus_user.login if campus_user else owner.username,
		'display_name': campus_user.display_name if campus_user else owner.username,
		'avatar_url': avatar_url,
		'active': active
	}


def get_or_create_friends_payload_for_user(user, request=None):
	friends_list, _created = FriendsList.objects.get_or_create(owner=user)

	friends_qs = friends_list.friends.select_related('owner', 'owner__campus_user_profile', 'owner__preferences').order_by('owner__username')
	received_qs = friends_list.friends_requests_received.select_related('owner', 'owner__campus_user_profile', 'owner__preferences').order_by('owner__username')
	sent_qs = friends_list.friends_requests_sent.select_related('owner', 'owner__campus_user_profile', 'owner__preferences').order_by('owner__username')

	return {
		'owner_user_id': user.id,
		'friends_count': friends_qs.count(),
		'pending_received_count': received_qs.count(),
		'pending_sent_count': sent_qs.count(),
		'friends': [_serialize_friend_entry(friend_list, request=request) for friend_list in friends_qs],
		'pending_received': [_serialize_friend_entry(friend_list, request=request) for friend_list in received_qs],
		'pending_sent': [_serialize_friend_entry(friend_list, request=request) for friend_list in sent_qs],
	}


def _serialize_user_achievements_for_export(campus_user):
	achievements = (
		UserAchievement.objects.filter(user=campus_user)
		.select_related('achievement')
		.order_by('achievement__name')
	)

	return [
		{
			'name': item.achievement.name,
			'description': item.achievement.description,
			'progress': item.progress,
			'completion_points': item.achievement.completion_points,
			'completion_date': item.completion_date.isoformat() if item.completion_date else None,
		}
		for item in achievements
	]


def build_user_gdpr_export(user, request=None):
	campus_user = getattr(user, 'campus_user_profile', None) or CampusUser.objects.filter(django_user=user).first()
	preferences = getattr(user, 'preferences', None)
	friends_payload = get_or_create_friends_payload_for_user(user, request=request)
	points_history = []
	if campus_user is not None:
		points_history = [
			{
				'date': snapshot.snapshot_date.isoformat(),
				'points': snapshot.coalition_user_score,
				'coalition_rank': snapshot.coalition_user_rank,
				'campus_rank': snapshot.campus_user_rank,
			}
			for snapshot in campus_user.score_snapshots.order_by('snapshot_date')
		]

	return {
		'generated_at': timezone.now().isoformat(),
		'account': {
			'id': user.id,
			'username': user.username,
			'email': user.email,
			'last_login': user.last_login.isoformat() if user.last_login else None,
			'date_joined': user.date_joined.isoformat() if user.date_joined else None,
		},
		'campus_profile': {
			'id': campus_user.id if campus_user else None,
			'intra_id': campus_user.intra_id if campus_user else None,
			'user_id': campus_user.user_id if campus_user else None,
			'login': campus_user.login if campus_user else None,
			'email': campus_user.email if campus_user else None,
			'display_name': campus_user.display_name if campus_user else None,
			'avatar_url': campus_user.avatar_url if campus_user else None,
			'level': str(campus_user.level) if campus_user else None,
			'wallet': campus_user.wallet if campus_user else None,
			'correction_points': campus_user.correction_points if campus_user else None,
			'coalition_id': campus_user.coalition_id if campus_user else None,
			'coalition_name': campus_user.coalition_name if campus_user else None,
			'coalition_slug': campus_user.coalition_slug if campus_user else None,
			'coalition_user_score': campus_user.coalition_user_score if campus_user else None,
			'coalition_rank': campus_user.coalition_rank if campus_user else None,
			'general_rank': campus_user.general_rank if campus_user else None,
			'evaluations_done_total': campus_user.evaluations_done_total if campus_user else None,
			'evaluations_done_current_season': campus_user.evaluations_done_current_season if campus_user else None,
			'is_active': campus_user.is_active if campus_user else None,
		},
		'preferences': {
			'items_per_page': preferences.items_per_page if preferences else None,
			'show_sensitive_data': preferences.show_sensitive_data if preferences else None,
			'theme_mode': preferences.theme_mode if preferences else None,
			'receive_notifications': preferences.receive_notifications if preferences else None,
			'custom_username': preferences.custom_username if preferences else None,
			'has_custom_avatar': bool(preferences and preferences.custom_avatar),
		},
		'friends': friends_payload,
		'points_history': points_history,
		'achievements': _serialize_user_achievements_for_export(campus_user) if campus_user else [],
	}


def send_gdpr_confirmation_email(user, operation_label, extra_lines=None):
	recipient = (user.email or '').strip()
	if not recipient:
		campus_user = getattr(user, 'campus_user_profile', None) or CampusUser.objects.filter(django_user=user).first()
		recipient = (getattr(campus_user, 'email', '') or '').strip()

	if not recipient:
		logger.warning('Skipping GDPR confirmation email for user_id=%s because no recipient email exists.', user.id)
		return False

	subject = f'AEDLPH {operation_label}'
	message_lines = [
		f'Hello {user.username},',
		'',
		f'Your request related to {operation_label.lower()} has been processed.',
	]
	if extra_lines:
		message_lines.extend([''] + list(extra_lines))
	message_lines.extend([
		'',
		'This message was generated automatically by AEDLPH.',
	])

	send_mail(
		subject,
		'\n'.join(message_lines),
		settings.DEFAULT_FROM_EMAIL,
		[recipient],
		fail_silently=False,
	)
	return True


def delete_user_account(user):
	with transaction.atomic():
		user.delete()
	return True


def get_pending_friend_requests_payload_for_user(user, request=None):
	friends_list, _created = FriendsList.objects.get_or_create(owner=user)

	received_qs = friends_list.friends_requests_received.select_related('owner', 'owner__campus_user_profile', 'owner__preferences').order_by('owner__username')
	sent_qs = friends_list.friends_requests_sent.select_related('owner', 'owner__campus_user_profile', 'owner__preferences').order_by('owner__username')

	return {
		'owner_user_id': user.id,
		'pending_received_count': received_qs.count(),
		'pending_sent_count': sent_qs.count(),
		'pending_received': [_serialize_friend_entry(friend_list, request=request) for friend_list in received_qs],
		'pending_sent': [_serialize_friend_entry(friend_list, request=request) for friend_list in sent_qs],
	}


def _get_or_create_friends_list(user):
	return FriendsList.objects.get_or_create(owner=user)[0]


def _resolve_target_user_by_login(login):
	if not login:
		raise FriendsRequestError('Target login is required', 400)

	campus_user = CampusUser.objects.select_related('django_user').filter(login=login).first()
	if campus_user and campus_user.django_user:
		return campus_user.django_user

	User = get_user_model()
	target_user = User.objects.filter(username=login).first()
	if target_user is None:
		raise FriendsRequestError('Target user not found', 404)

	return target_user


def search_users_for_friend_requests(current_user, query):
	if not query or len(query.strip()) < 2:
		return []

	normalized_query = query.strip().lower()
	friends_list, _ = FriendsList.objects.get_or_create(owner=current_user)
	blocked_user_ids = set(friends_list.friends.values_list('owner_id', flat=True))
	blocked_user_ids.update(friends_list.friends_requests_sent.values_list('owner_id', flat=True))
	blocked_user_ids.update(friends_list.friends_requests_received.values_list('owner_id', flat=True))

	base_qs = (
		CampusUser.objects
		.select_related('django_user')
		.filter(django_user__isnull=False)
		.filter(login__icontains=normalized_query)
		.exclude(django_user_id=current_user.id)
		.exclude(django_user_id__in=blocked_user_ids)
		.order_by('login')
	)[:10]

	return [
		{
			'login': campus_user.login,
			'display_name': campus_user.display_name or campus_user.login,
			'avatar_url': campus_user.avatar_url,
		}
		for campus_user in base_qs
	]


def send_friend_request(from_user, to_login):
	to_user = _resolve_target_user_by_login(to_login)
	if from_user.id == to_user.id:
		raise FriendsRequestError('You cannot send a friend request to yourself', 400)

	from_list = _get_or_create_friends_list(from_user)
	to_list = _get_or_create_friends_list(to_user)

	if from_list.friends.filter(pk=to_list.pk).exists():
		raise FriendsRequestError('Users are already friends', 409)

	if from_list.friends_requests_sent.filter(pk=to_list.pk).exists():
		raise FriendsRequestError('Friend request already sent', 409)

	if from_list.friends_requests_received.filter(pk=to_list.pk).exists():
		raise FriendsRequestError('This user already sent you a friend request', 409)

	with transaction.atomic():
		from_list.friends_requests_sent.add(to_list)
		to_list.friends_requests_received.add(from_list)
	return to_user


def accept_friend_request(current_user, from_login):
	from_user = _resolve_target_user_by_login(from_login)
	if current_user.id == from_user.id:
		raise FriendsRequestError('You cannot accept your own friend request', 400)

	current_list = _get_or_create_friends_list(current_user)
	from_list = _get_or_create_friends_list(from_user)

	if not current_list.friends_requests_received.filter(pk=from_list.pk).exists():
		raise FriendsRequestError('No pending friend request from this user', 404)

	with transaction.atomic():
		current_list.friends_requests_received.remove(from_list)
		from_list.friends_requests_sent.remove(current_list)
		current_list.friends.add(from_list)
	return from_user


def reject_friend_request(current_user, from_login):
	from_user = _resolve_target_user_by_login(from_login)
	if current_user.id == from_user.id:
		raise FriendsRequestError('You cannot reject your own friend request', 400)

	current_list = _get_or_create_friends_list(current_user)
	from_list = _get_or_create_friends_list(from_user)

	if not current_list.friends_requests_received.filter(pk=from_list.pk).exists():
		raise FriendsRequestError('No pending friend request from this user', 404)

	with transaction.atomic():
		current_list.friends_requests_received.remove(from_list)
		from_list.friends_requests_sent.remove(current_list)
	return from_user


def withdraw_friend_request(current_user, to_login):
	to_user = _resolve_target_user_by_login(to_login)
	if current_user.id == to_user.id:
		raise FriendsRequestError('You cannot withdraw a request to yourself', 400)

	current_list = _get_or_create_friends_list(current_user)
	to_list = _get_or_create_friends_list(to_user)

	if not current_list.friends_requests_sent.filter(pk=to_list.pk).exists():
		raise FriendsRequestError('No pending friend request to this user', 404)

	with transaction.atomic():
		current_list.friends_requests_sent.remove(to_list)
		to_list.friends_requests_received.remove(current_list)
	return to_user


def remove_friend(current_user, friend_login):
	friend_user = _resolve_target_user_by_login(friend_login)
	if current_user.id == friend_user.id:
		raise FriendsRequestError('You cannot remove yourself from friends', 400)

	current_list = _get_or_create_friends_list(current_user)
	friend_list = _get_or_create_friends_list(friend_user)

	if not current_list.friends.filter(pk=friend_list.pk).exists():
		raise FriendsRequestError('Users are not friends', 404)

	with transaction.atomic():
		current_list.friends.remove(friend_list)
	return friend_user

def get_achivements_for(login) -> list[UserAchievement] | None:
	set_up_achievements()

	campus_user = CampusUser.objects.filter(login=login).first()
	if campus_user is None:
		return None
	
	achievements_of_user = list(UserAchievement.objects.filter(user=campus_user).iterator())

	print(len(achievements_of_user), ' | ', Achievement.objects.count())

	# Check missing achievements and add them
	if len(achievements_of_user) < Achievement.objects.count():
		new_len = len(achievements_of_user)
		for achievement in list(Achievement.objects.iterator()):
			if UserAchievement.objects.filter(achievement=achievement).filter(user=campus_user).count() != 0:
				continue

			new_row = UserAchievement(user=campus_user, achievement=achievement, completion_date=None)
			new_row.save()
			print('added achievement to user')

			new_len += 1
			if new_len >= Achievement.objects.count():
				break

		achievements_of_user = list(UserAchievement.objects.filter(user=campus_user).iterator())

	if Achievement.objects.count() == 0:
		return None


	# Check for achievement completion
	missing_func = False
	for achievement in achievements_of_user:
		name = achievement.achievement.name
		check_func = Achievement.completion_check_funcs[name]
		if check_func == None:
			print('Missing achievement completion check function for ', name)
			missing_func = True
			continue

		# Set to True to allow value progression after getting the achievement
		if False or achievement.completion_date == None:
			if check_func(achievement):
				achievement.completion_date = datetime.now()
				achievement.save(update_fields=['completion_date'])
	
	if missing_func:
		print('Add the check function inside User/models.py->Achievement.__init__()', end='')
		print(', the file User/achievement_functions.py exists to hold these functions.')
	return achievements_of_user