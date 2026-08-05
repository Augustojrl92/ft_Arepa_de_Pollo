from django.conf import settings
from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken
from unittest.mock import patch

from sync.models import CampusUser
from users.models import FriendsList

from .models import GameMatch


TEST_CHANNEL_LAYERS = {
	'default': {
		'BACKEND': 'channels.layers.InMemoryChannelLayer',
	},
}
TEST_SIMPLE_JWT = {
	'SIGNING_KEY': 'tests-only-signing-key-with-more-than-32-bytes',
}


class GamesAppConfigTests(SimpleTestCase):
	def test_games_app_is_installed(self):
		self.assertIn('games', settings.INSTALLED_APPS)


@override_settings(
	CHANNEL_LAYERS=TEST_CHANNEL_LAYERS,
	SECRET_KEY='tests-only-secret-key-with-more-than-32-bytes',
	SIMPLE_JWT=TEST_SIMPLE_JWT,
)
class MultiplayerGameApiTests(TestCase):
	def setUp(self):
		self.first = self._create_user('first', 101)
		self.second = self._create_user('second', 102)
		self.stranger = self._create_user('stranger', 103)
		self.third = self._create_user('third', 104)
		first_list = FriendsList.objects.create(owner=self.first)
		second_list = FriendsList.objects.create(owner=self.second)
		third_list = FriendsList.objects.create(owner=self.third)
		first_list.friends.add(second_list)
		second_list.friends.add(third_list)
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

	def _create_two_invitations_for_second(self):
		self._authenticate(self.first)
		first_match = self.client.post(
			'/api/games/matches/',
			{'opponent_login': 'second', 'target_score': 3},
			content_type='application/json',
		)
		self.assertEqual(first_match.status_code, 201)
		self._authenticate(self.third)
		third_match = self.client.post(
			'/api/games/matches/',
			{'opponent_login': 'second', 'target_score': 5},
			content_type='application/json',
		)
		self.assertEqual(third_match.status_code, 201)
		return first_match.json()['id'], third_match.json()['id']

	def _complete_match(self, target_score=3):
		match_id = self._invite_and_accept(target_score=target_score)
		for _round in range(target_score):
			self._authenticate(self.first)
			self.client.post(
				f'/api/games/matches/{match_id}/move/',
				{'choice': 'spock'},
				content_type='application/json',
			)
			self._authenticate(self.second)
			self.client.post(
				f'/api/games/matches/{match_id}/move/',
				{'choice': 'rock'},
				content_type='application/json',
			)
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

	def test_only_one_invitation_can_be_accepted_and_other_inviter_can_cancel(self):
		first_match_id, third_match_id = self._create_two_invitations_for_second()
		self._authenticate(self.second)
		accepted = self.client.patch(
			f'/api/games/matches/{first_match_id}/',
			{'action': 'accept'},
			content_type='application/json',
		)
		blocked = self.client.patch(
			f'/api/games/matches/{third_match_id}/',
			{'action': 'accept'},
			content_type='application/json',
		)

		self.assertEqual(accepted.status_code, 200)
		self.assertEqual(blocked.status_code, 409)
		self.assertEqual(blocked.json()['error'], 'Ya estas en una partida activa')
		self.assertEqual(GameMatch.objects.get(pk=first_match_id).status, GameMatch.Status.ACTIVE)
		self.assertEqual(GameMatch.objects.get(pk=third_match_id).status, GameMatch.Status.PENDING)

		self._authenticate(self.third)
		outgoing = self.client.get('/api/games/matches/').json()['outgoing']
		waiting_match = next(match for match in outgoing if match['id'] == third_match_id)
		self.assertTrue(waiting_match['opponent_busy'])
		cancelled = self.client.patch(
			f'/api/games/matches/{third_match_id}/',
			{'action': 'cancel'},
			content_type='application/json',
		)
		self.assertEqual(cancelled.status_code, 200)
		self.assertEqual(cancelled.json()['status'], 'cancelled')

	def test_pending_invitation_can_wait_until_active_match_finishes(self):
		first_match_id, third_match_id = self._create_two_invitations_for_second()
		self._authenticate(self.second)
		self.client.patch(
			f'/api/games/matches/{first_match_id}/',
			{'action': 'accept'},
			content_type='application/json',
		)

		self._authenticate(self.third)
		waiting_match = next(
			match for match in self.client.get('/api/games/matches/').json()['outgoing']
			if match['id'] == third_match_id
		)
		self.assertTrue(waiting_match['opponent_busy'])

		self._authenticate(self.first)
		finished = self.client.patch(
			f'/api/games/matches/{first_match_id}/',
			{'action': 'forfeit'},
			content_type='application/json',
		)
		self.assertEqual(finished.status_code, 200)

		self._authenticate(self.third)
		available_match = next(
			match for match in self.client.get('/api/games/matches/').json()['outgoing']
			if match['id'] == third_match_id
		)
		self.assertFalse(available_match['opponent_busy'])

		self._authenticate(self.second)
		accepted = self.client.patch(
			f'/api/games/matches/{third_match_id}/',
			{'action': 'accept'},
			content_type='application/json',
		)
		self.assertEqual(accepted.status_code, 200)
		self.assertEqual(accepted.json()['status'], 'active')

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

	def test_rematch_request_persists_for_both_players(self):
		match_id = self._complete_match()
		self._authenticate(self.first)
		requested = self.client.post(f'/api/games/matches/{match_id}/rematch/')

		self.assertEqual(requested.status_code, 201)
		self.assertEqual(requested.json()['status'], 'completed')
		self.assertEqual(requested.json()['rematch_status'], 'pending')
		self.assertEqual(requested.json()['rematch_requested_by_user_id'], self.first.id)

		self._authenticate(self.second)
		incoming = self.client.get('/api/games/matches/').json()['rematch_incoming']
		self.assertEqual([match['id'] for match in incoming], [match_id])

		self._authenticate(self.first)
		outgoing = self.client.get('/api/games/matches/').json()['rematch_outgoing']
		self.assertEqual([match['id'] for match in outgoing], [match_id])

	def test_accepting_rematch_starts_linked_match_for_both_players(self):
		match_id = self._complete_match(target_score=5)
		self._authenticate(self.first)
		self.client.post(f'/api/games/matches/{match_id}/rematch/')
		self._authenticate(self.second)

		accepted = self.client.patch(
			f'/api/games/matches/{match_id}/rematch/',
			{'action': 'accept'},
			content_type='application/json',
		)

		self.assertEqual(accepted.status_code, 200)
		self.assertEqual(accepted.json()['status'], 'active')
		self.assertEqual(accepted.json()['target_score'], 5)
		new_match = GameMatch.objects.get(pk=accepted.json()['id'])
		self.assertEqual(new_match.rematch_of_id, match_id)
		self.assertEqual(new_match.rounds.count(), 1)
		original = GameMatch.objects.get(pk=match_id)
		self.assertEqual(original.rematch_status, GameMatch.RematchStatus.ACCEPTED)

	def test_two_rematch_requests_are_treated_as_acceptance(self):
		match_id = self._complete_match()
		self._authenticate(self.first)
		self.client.post(f'/api/games/matches/{match_id}/rematch/')
		self._authenticate(self.second)

		response = self.client.post(f'/api/games/matches/{match_id}/rematch/')

		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.json()['status'], 'active')
		self.assertEqual(GameMatch.objects.filter(rematch_of_id=match_id).count(), 1)

	def test_rematch_can_be_rejected_and_requested_again(self):
		match_id = self._complete_match()
		self._authenticate(self.first)
		self.client.post(f'/api/games/matches/{match_id}/rematch/')
		self._authenticate(self.second)
		rejected = self.client.patch(
			f'/api/games/matches/{match_id}/rematch/',
			{'action': 'reject'},
			content_type='application/json',
		)

		self.assertEqual(rejected.status_code, 200)
		self.assertEqual(rejected.json()['rematch_status'], 'rejected')
		self.assertEqual(self.client.get('/api/games/matches/').json()['rematch_incoming'], [])

		retry = self.client.post(f'/api/games/matches/{match_id}/rematch/')
		self.assertEqual(retry.status_code, 201)
		self.assertEqual(retry.json()['rematch_status'], 'pending')
		self.assertEqual(retry.json()['rematch_requested_by_user_id'], self.second.id)

	@patch('games.views.broadcast_game_event')
	def test_invitation_emits_realtime_event(self, broadcast):
		response = self.client.post(
			'/api/games/matches/',
			{'opponent_login': 'second', 'target_score': 3},
			content_type='application/json',
		)

		self.assertEqual(response.status_code, 201)
		broadcast.assert_called_once()
		match, event_name = broadcast.call_args.args
		self.assertEqual(match.id, response.json()['id'])
		self.assertEqual(event_name, 'invitation.created')

	@patch('games.views.broadcast_game_event')
	def test_move_emits_realtime_event_without_choice_payload(self, broadcast):
		match_id = self._invite_and_accept()
		broadcast.reset_mock()
		self._authenticate(self.first)

		response = self.client.post(
			f'/api/games/matches/{match_id}/move/',
			{'choice': 'rock'},
			content_type='application/json',
		)

		self.assertEqual(response.status_code, 200)
		broadcast.assert_called_once()
		match, event_name = broadcast.call_args.args
		self.assertEqual(match.id, match_id)
		self.assertEqual(event_name, 'match.move_submitted')
