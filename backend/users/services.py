from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from sync.models import CampusUser
from .models import Achievement, AchievementEvent, FriendsList, UserAchievementList


class FriendsRequestError(Exception):
	def __init__(self, message, http_status):
		super().__init__(message)
		self.message = message
		self.http_status = http_status


DEFAULT_ACHIEVEMENTS = [
	{
		'slug': 'primer-contacto',
		'title': 'Primer contacto',
		'description': 'Envía tu primera solicitud de amistad.',
		'icon': 'friend-request',
		'progress': 0,
		'status': 'in_progress',
	},
	{
		'slug': 'red-inicial',
		'title': 'Red inicial',
		'description': 'Consigue tu primer amigo confirmado.',
		'icon': 'friend-accepted',
		'progress': 100,
		'status': 'completed',
	},
	{
		'slug': 'colega-activo',
		'title': 'Colega activo',
		'description': 'Completa el perfil básico y empieza a seguir gente.',
		'icon': 'profile-complete',
		'progress': 30,
		'status': 'in_progress',
	},
]

DEFAULT_PROGRESS_BY_SLUG = {
	achievement_data['slug']: achievement_data['progress']
	for achievement_data in DEFAULT_ACHIEVEMENTS
}

def _serialize_user_details(user_login):
	campus_user = CampusUser.objects.filter(login=user_login).first()
	
	if campus_user is None:
		return None
	
	return {
		'id': campus_user.user_id,
		'login': campus_user.login,
		'display_name': campus_user.display_name,
		'avatar_url': campus_user.avatar_url,
		'level': campus_user.level,
		'coalition_name': campus_user.coalition_name,
		'coalition_slug': campus_user.coalition_slug,
		'coalition_points': campus_user.coalition_user_score,
		'coalition_rank': campus_user.coalition_rank,
		'general_rank': campus_user.general_rank,
		'achievements': 'none'  # Placeholder for achievements data,
	}

def _serialize_friend_entry(friend_list):
	owner = friend_list.owner
	campus_user = getattr(owner, 'campus_user_profile', None)

	return {
		'user_id': owner.id,
		'username': owner.username,
		'login': campus_user.login if campus_user else owner.username,
		'display_name': campus_user.display_name if campus_user else owner.username,
		'avatar_url': campus_user.avatar_url if campus_user else '',
	}


def _serialize_achievement_state(achievement, status, completion_date=None):
	return {
		'id': achievement.id,
		'slug': achievement.slug,
		'title': achievement.title,
		'description': achievement.description,
		'icon': achievement.icon,
		'completed': status == 'completed',
		'completionDate': completion_date.isoformat() if completion_date else None,
		'completion_date': completion_date.isoformat() if completion_date else None,
		'progress': 100 if status == 'completed' else DEFAULT_PROGRESS_BY_SLUG.get(achievement.slug or '', 0),
		'status': status,
	}


def _seed_default_achievements(user_achievement_list):
	seeded_achievements = []
	for achievement_data in DEFAULT_ACHIEVEMENTS:
		achievement, _created = Achievement.objects.get_or_create(
			slug=achievement_data['slug'],
			defaults={
				'title': achievement_data['title'],
				'description': achievement_data['description'],
				'icon': achievement_data['icon'],
			},
		)
		seeded_achievements.append(achievement)

	completed_slugs = {
		achievement_data['slug']
		for achievement_data in DEFAULT_ACHIEVEMENTS
		if achievement_data['status'] == 'completed'
	}
	in_progress_slugs = {
		achievement_data['slug']
		for achievement_data in DEFAULT_ACHIEVEMENTS
		if achievement_data['status'] == 'in_progress'
	}

	completed = [achievement for achievement in seeded_achievements if achievement.slug in completed_slugs]
	in_progress = [achievement for achievement in seeded_achievements if achievement.slug in in_progress_slugs]

	user_achievement_list.completed_achievements.add(*completed)
	user_achievement_list.in_progress_achievements.add(*in_progress)

	if completed:
		user_achievement_list.in_progress_achievements.remove(*completed)


def get_or_create_achievement_list_for_user(user):
	achievement_list, _created = UserAchievementList.objects.get_or_create(owner=user)
	_seed_default_achievements(achievement_list)
	return achievement_list


def _latest_completion_by_achievement(user):
	completion_events = (
		user.achievement_events
		.filter(event_type=AchievementEvent.EVENT_COMPLETED)
		.values('achievement_id', 'created_at')
		.order_by('achievement_id', '-created_at')
	)

	latest_completion = {}
	for event in completion_events:
		achievement_id = event['achievement_id']
		if achievement_id in latest_completion:
			continue
		latest_completion[achievement_id] = event

	return latest_completion


def get_achievements_payload_for_user(user):
	achievement_list = get_or_create_achievement_list_for_user(user)
	completed_qs = achievement_list.completed_achievements.order_by('title')
	in_progress_qs = achievement_list.in_progress_achievements.order_by('title')
	latest_completion = _latest_completion_by_achievement(user)

	achievements_payload = []
	for achievement in completed_qs:
		completion_date = None
		event_data = latest_completion.get(achievement.id)
		if event_data:
			completion_date = event_data.get('created_at')
		achievements_payload.append(_serialize_achievement_state(achievement, 'completed', completion_date))

	for achievement in in_progress_qs:
		achievements_payload.append(_serialize_achievement_state(achievement, 'in_progress'))

	achievements_payload.sort(key=lambda achievement_data: achievement_data['title'].lower())

	return {
		'owner_user_id': user.id,
		'completed_count': completed_qs.count(),
		'in_progress_count': in_progress_qs.count(),
		'achievements_count': len(achievements_payload),
		'achievements': achievements_payload,
	}


def build_achievement_completed_event_payload(user, achievement):
	return {
		'user_id': user.id,
		'achievement_id': achievement.id,
		'achievement_slug': achievement.slug,
		'achievement_title': achievement.title,
		'status': 'completed',
		'progress': 100,
		'completed_at': timezone.now().isoformat(),
	}


def emit_achievement_completed_event(user, achievement):
	return AchievementEvent.objects.create(
		owner=user,
		achievement=achievement,
		event_type=AchievementEvent.EVENT_COMPLETED,
		payload=build_achievement_completed_event_payload(user, achievement),
	)


def complete_achievement_for_user(user, achievement_slug):
	achievement_list = get_or_create_achievement_list_for_user(user)
	achievement = Achievement.objects.filter(slug=achievement_slug).first()
	if achievement is None:
		raise ValueError('Achievement not found')

	if achievement_list.completed_achievements.filter(pk=achievement.pk).exists():
		return achievement

	with transaction.atomic():
		achievement_list.in_progress_achievements.remove(achievement)
		achievement_list.completed_achievements.add(achievement)
		emit_achievement_completed_event(user, achievement)

	return achievement


def get_pending_achievement_events_for_user(user):
	events_qs = user.achievement_events.filter(delivered_at__isnull=True).select_related('achievement').order_by('created_at')
	events = list(events_qs)
	if events:
		AchievementEvent.objects.filter(pk__in=[event.pk for event in events]).update(delivered_at=timezone.now())
	return {
		'owner_user_id': user.id,
		'events_count': len(events),
		'events': [
			{
				'id': event.id,
				'event_type': event.event_type,
				'payload': event.payload,
				'created_at': event.created_at.isoformat(),
			}
			for event in events
		],
	}


def get_or_create_friends_payload_for_user(user):
	friends_list, _created = FriendsList.objects.get_or_create(owner=user)

	friends_qs = friends_list.friends.select_related('owner', 'owner__campus_user_profile').order_by('owner__username')
	received_qs = friends_list.friends_requests_received.select_related('owner', 'owner__campus_user_profile').order_by('owner__username')
	sent_qs = friends_list.friends_requests_sent.select_related('owner', 'owner__campus_user_profile').order_by('owner__username')

	return {
		'owner_user_id': user.id,
		'friends_count': friends_qs.count(),
		'pending_received_count': received_qs.count(),
		'pending_sent_count': sent_qs.count(),
		'friends': [_serialize_friend_entry(friend_list) for friend_list in friends_qs],
		'pending_received': [_serialize_friend_entry(friend_list) for friend_list in received_qs],
		'pending_sent': [_serialize_friend_entry(friend_list) for friend_list in sent_qs],
	}


def get_pending_friend_requests_payload_for_user(user):
	friends_list, _created = FriendsList.objects.get_or_create(owner=user)

	received_qs = friends_list.friends_requests_received.select_related('owner', 'owner__campus_user_profile').order_by('owner__username')
	sent_qs = friends_list.friends_requests_sent.select_related('owner', 'owner__campus_user_profile').order_by('owner__username')

	return {
		'owner_user_id': user.id,
		'pending_received_count': received_qs.count(),
		'pending_sent_count': sent_qs.count(),
		'pending_received': [_serialize_friend_entry(friend_list) for friend_list in received_qs],
		'pending_sent': [_serialize_friend_entry(friend_list) for friend_list in sent_qs],
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
