from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.utils import timezone
from django.utils.functional import SimpleLazyObject
from rest_framework_simplejwt.tokens import RefreshToken

from sync.models import CampusUser, CampusUserScoreSnapshot
from users.models import FriendsList
from users.services import send_friend_request


TEST_CHANNEL_LAYERS = {
	'default': {
		'BACKEND': 'channels.layers.InMemoryChannelLayer',
	},
}
TEST_SIMPLE_JWT = {
	'SIGNING_KEY': 'tests-only-signing-key-with-more-than-32-bytes',
}


class UserPointsHistoryViewTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(username='tester', password='secret123')
		access_token = str(RefreshToken.for_user(self.user).access_token)
		self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {access_token}'

		self.campus_user = CampusUser.objects.create(
			django_user=self.user,
			intra_id=42,
			user_id=42,
			level=5.5,
			login='tester',
			email='tester@example.com',
			display_name='Tester User',
			avatar_url='https://example.com/avatar.jpg',
			coalition_id=401,
			coalitions_user_id=9001,
			coalition_name='Zefiria',
			coalition_slug='zefiria',
			coalition_user_score=1500,
			coalition_rank=3,
			general_rank=10,
			created_at=timezone.make_aware(timezone.datetime(2026, 4, 8, 12, 0, 0)),
			updated_at=timezone.make_aware(timezone.datetime(2026, 4, 9, 12, 0, 0)),
		)
		CampusUserScoreSnapshot.objects.create(
			campus_user=self.campus_user,
			snapshot_date='2026-04-08',
			coalition_user_score=1200,
			coalition_user_rank=4,
			campus_user_rank=12,
		)
		CampusUserScoreSnapshot.objects.create(
			campus_user=self.campus_user,
			snapshot_date='2026-04-09',
			coalition_user_score=1500,
			coalition_user_rank=3,
			campus_user_rank=10,
		)

	def test_returns_points_history_payload(self):
		response = self.client.get('/api/users/points-history/', {'login': 'tester'})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['user']['login'], 'tester')
		self.assertEqual(
			response.json()['history'],
			[
				{'date': '2026-04-08', 'points': 1200, 'coalition_rank': 4, 'campus_rank': 12},
				{'date': '2026-04-09', 'points': 1500, 'coalition_rank': 3, 'campus_rank': 10},
			],
		)


@override_settings(
	CHANNEL_LAYERS=TEST_CHANNEL_LAYERS,
	SECRET_KEY='tests-only-secret-key-with-more-than-32-bytes',
	SIMPLE_JWT=TEST_SIMPLE_JWT,
)
class FriendRealtimeEventTests(TestCase):
	def setUp(self):
		self.sender = self._create_user('sender', 501)
		self.receiver = self._create_user('receiver', 502)
		FriendsList.objects.create(owner=self.sender)
		FriendsList.objects.create(owner=self.receiver)
		self._authenticate(self.sender)

	def _create_user(self, login, intra_id):
		user = User.objects.create_user(username=login, password='secret123')
		now = timezone.now()
		CampusUser.objects.create(
			django_user=user,
			intra_id=intra_id,
			user_id=intra_id,
			level=1,
			login=login,
			email=f'{login}@example.com',
			display_name=login.title(),
			avatar_url='',
			coalition_id=1,
			coalitions_user_id=intra_id,
			coalition_name='Test',
			coalition_slug='test',
			coalition_user_score=0,
			coalition_rank=1,
			general_rank=1,
			created_at=now,
			updated_at=now,
		)
		return user

	def _authenticate(self, user):
		token = str(RefreshToken.for_user(user).access_token)
		self.client.defaults['HTTP_AUTHORIZATION'] = f'Bearer {token}'

	@patch('users.views.broadcast_friend_event')
	def test_sending_request_notifies_both_users(self, broadcast):
		response = self.client.post(
			'/api/users/friends/requests/',
			{'login': 'receiver'},
			content_type='application/json',
		)

		self.assertEqual(response.status_code, 201)
		users, event_name, actor = broadcast.call_args.args
		self.assertEqual({user.id for user in users}, {self.sender.id, self.receiver.id})
		self.assertEqual(event_name, 'friend.request.created')
		self.assertEqual(actor.id, self.sender.id)

	@patch('users.views.broadcast_friend_event')
	def test_accepting_request_notifies_both_users(self, broadcast):
		send_friend_request(self.sender, 'receiver')
		self._authenticate(self.receiver)
		response = self.client.patch(
			'/api/users/friends/requests/',
			{'login': 'sender', 'action': 'accept'},
			content_type='application/json',
		)

		self.assertEqual(response.status_code, 200)
		users, event_name, actor = broadcast.call_args.args
		self.assertEqual({user.id for user in users}, {self.sender.id, self.receiver.id})
		self.assertEqual(event_name, 'friend.request.accepted')
		self.assertEqual(actor.id, self.receiver.id)
	def test_get_or_create_friends_payload_accepts_lazy_users(self):
		lazy_user = SimpleLazyObject(lambda: self.user)

		payload = get_or_create_friends_payload_for_user(lazy_user)

		self.assertEqual(payload['owner_user_id'], self.user.id)
		self.assertEqual(payload['friends_count'], 0)
