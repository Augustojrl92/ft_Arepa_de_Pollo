from django.contrib.auth import get_user_model
from django.db import transaction

from sync.models import CampusUser
from .models import FriendsList


class FriendsRequestError(Exception):
	def __init__(self, message, http_status):
		super().__init__(message)
		self.message = message
		self.http_status = http_status

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
