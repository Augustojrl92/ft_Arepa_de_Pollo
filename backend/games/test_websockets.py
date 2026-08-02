from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import RefreshToken

from config.asgi import application

from .events import game_user_group


TEST_CHANNEL_LAYERS = {
	'default': {
		'BACKEND': 'channels.layers.InMemoryChannelLayer',
	},
}
TEST_SIMPLE_JWT = {
	'SIGNING_KEY': 'tests-only-signing-key-with-more-than-32-bytes',
}


@override_settings(
	CHANNEL_LAYERS=TEST_CHANNEL_LAYERS,
	ALLOWED_HOSTS=['localhost', 'testserver'],
	SECRET_KEY='tests-only-secret-key-with-more-than-32-bytes',
	SIMPLE_JWT=TEST_SIMPLE_JWT,
)
class GameWebSocketTests(TransactionTestCase):
	def setUp(self):
		self.user = User.objects.create_user(username='socket-player', password='secret123')

	def test_anonymous_connection_is_rejected(self):
		async def scenario():
			communicator = WebsocketCommunicator(
				application,
				'/ws/games/',
				headers=[(b'origin', b'http://localhost:3000')],
			)
			connected, close_code = await communicator.connect()
			self.assertFalse(connected)
			self.assertEqual(close_code, 4401)

		async_to_sync(scenario)()

	def test_authenticated_user_receives_private_game_events(self):
		token = str(RefreshToken.for_user(self.user).access_token)

		async def scenario():
			communicator = WebsocketCommunicator(
				application,
				'/ws/games/',
				headers=[
					(b'origin', b'http://localhost:3000'),
					(b'cookie', f'access_token={token}'.encode()),
				],
			)
			connected, _detail = await communicator.connect()
			self.assertTrue(connected)
			self.assertEqual(await communicator.receive_json_from(), {'type': 'game.connected'})

			payload = {
				'type': 'game.event',
				'event': 'invitation.created',
				'match_id': 42,
				'match_status': 'pending',
				'occurred_at': '2026-08-02T12:00:00Z',
			}
			channel_layer = get_channel_layer()
			await channel_layer.group_send(
				game_user_group(self.user.id),
				{'type': 'game_event', 'payload': payload},
			)

			self.assertEqual(await communicator.receive_json_from(), payload)
			await communicator.disconnect()

		async_to_sync(scenario)()
