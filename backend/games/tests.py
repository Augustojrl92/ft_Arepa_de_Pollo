from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from sync.models import CampusUser
from users.models import FriendsList

from .models import GameMatch


class MultiplayerGameApiTests(TestCase):
	def setUp(self):
		self.first = self._create_user('first', 101)
		self.second = self._create_user('second', 102)
		self.stranger = self._create_user('stranger', 103)
		first_list = FriendsList.objects.create(owner=self.first)
		second_list = FriendsList.objects.create(owner=self.second)
		first_list.friends.add(second_list)
		self._authenticate(self.first)

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

	def _invite_and_accept(self, target_score=3):
		response = self.client.post(
			'/api/games/matches/',
			{'opponent_login': 'second', 'target_score': target_score},
			content_type='application/json',
		)
		self.assertEqual(response.status_code, 201)
		match_id = response.json()['id']
		self._authenticate(self.second)
		response = self.client.patch(
			f'/api/games/matches/{match_id}/',
			{'action': 'accept'},
			content_type='application/json',
		)
		self.assertEqual(response.status_code, 200)
		return match_id

	def test_only_friends_can_be_invited(self):
		response = self.client.post(
			'/api/games/matches/',
			{'opponent_login': 'stranger', 'target_score': 3},
			content_type='application/json',
		)

		self.assertEqual(response.status_code, 403)
		self.assertEqual(response.json()['error'], 'You can only invite friends')

	def test_invited_friend_can_accept(self):
		match_id = self._invite_and_accept()
		payload = self.client.get(f'/api/games/matches/{match_id}/').json()

		self.assertEqual(payload['status'], 'active')
		self.assertEqual(payload['current_round']['number'], 1)
		self.assertEqual(payload['role'], 'opponent')

	def test_choice_is_hidden_until_both_players_submit(self):
		match_id = self._invite_and_accept()
		self._authenticate(self.first)
		response = self.client.post(
			f'/api/games/matches/{match_id}/move/',
			{'choice': 'rock'},
			content_type='application/json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertNotIn('inviter_choice', response.json()['current_round'])
		self._authenticate(self.second)
		payload = self.client.get(f'/api/games/matches/{match_id}/').json()
		self.assertTrue(payload['current_round']['opponent_choice_submitted'])
		self.assertNotIn('opponent_choice', payload['current_round'])

	def test_round_is_resolved_by_backend_and_duplicate_move_is_rejected(self):
		match_id = self._invite_and_accept()
		self._authenticate(self.first)
		self.client.post(f'/api/games/matches/{match_id}/move/', {'choice': 'rock'}, content_type='application/json')
		duplicate = self.client.post(f'/api/games/matches/{match_id}/move/', {'choice': 'paper'}, content_type='application/json')
		self.assertEqual(duplicate.status_code, 409)

		self._authenticate(self.second)
		response = self.client.post(
			f'/api/games/matches/{match_id}/move/',
			{'choice': 'scissors'},
			content_type='application/json',
		)
		payload = response.json()
		self.assertEqual(payload['inviter_score'], 1)
		self.assertEqual(payload['opponent_score'], 0)
		self.assertEqual(payload['rounds'][0]['verb'], 'aplasta')
		self.assertEqual(payload['current_round']['number'], 2)

	def test_first_player_to_target_completes_match(self):
		match_id = self._invite_and_accept(target_score=3)
		for _round in range(3):
			self._authenticate(self.first)
			self.client.post(f'/api/games/matches/{match_id}/move/', {'choice': 'spock'}, content_type='application/json')
			self._authenticate(self.second)
			response = self.client.post(f'/api/games/matches/{match_id}/move/', {'choice': 'rock'}, content_type='application/json')

		payload = response.json()
		self.assertEqual(payload['status'], 'completed')
		self.assertEqual(payload['winner_user_id'], self.first.id)
		self.assertEqual(payload['inviter_score'], 3)
		self.assertIsNone(payload['current_round'])
		self.assertEqual(GameMatch.objects.get(pk=match_id).status, GameMatch.Status.COMPLETED)

	def test_forfeit_awards_match_to_other_player(self):
		match_id = self._invite_and_accept()
		response = self.client.patch(
			f'/api/games/matches/{match_id}/',
			{'action': 'forfeit'},
			content_type='application/json',
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()['status'], 'completed')
		self.assertEqual(response.json()['winner_user_id'], self.first.id)
