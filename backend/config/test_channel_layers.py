import asyncio
import os
from unittest import skipUnless
from uuid import uuid4

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from channels_redis.core import RedisChannelLayer
from django.conf import settings
from django.contrib.auth.models import User
from django.test import SimpleTestCase, TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import RefreshToken

from config.asgi import application
from config.realtime import user_realtime_group


RUN_REDIS_TESTS = os.getenv('RUN_REDIS_CHANNEL_TESTS') == '1'
REDIS_TEST_URL = os.getenv('REDIS_TEST_URL', 'redis://redis:6379/15')
REDIS_TEST_CHANNEL_LAYERS = {
	'default': {
		'BACKEND': 'channels_redis.core.RedisChannelLayer',
		'CONFIG': {
			'hosts': [REDIS_TEST_URL],
			'prefix': 'ggc99-tests',
		},
	},
}
TEST_SIMPLE_JWT = {
	'SIGNING_KEY': 'tests-only-signing-key-with-more-than-32-bytes',
}


class ChannelLayerConfigurationTests(SimpleTestCase):
	def test_default_channel_layer_uses_redis(self):
		self.assertEqual(
			settings.CHANNEL_LAYERS['default']['BACKEND'],
			'channels_redis.core.RedisChannelLayer',
		)
		self.assertEqual(
			settings.CHANNEL_LAYERS['default']['CONFIG']['hosts'],
			[os.getenv('CHANNEL_REDIS_URL', 'redis://redis:6379/0')],
		)


@skipUnless(RUN_REDIS_TESTS, 'Set RUN_REDIS_CHANNEL_TESTS=1 to run Redis integration tests')
class RedisChannelLayerIntegrationTests(SimpleTestCase):
	def test_two_independent_layers_exchange_a_message(self):
		async def scenario():
			prefix = f'ggc99-{uuid4().hex}'
			sender = RedisChannelLayer(hosts=[REDIS_TEST_URL], prefix=prefix, expiry=5)
			receiver = RedisChannelLayer(hosts=[REDIS_TEST_URL], prefix=prefix, expiry=5)
			try:
				channel = await receiver.new_channel('ggc99.')
				payload = {'type': 'ggc99.message', 'value': 'redis-cross-instance'}
				await sender.send(channel, payload)
				received = await asyncio.wait_for(receiver.receive(channel), timeout=3)
				self.assertEqual(received, payload)
			finally:
				await sender.flush()
				await sender.close_pools()
				await receiver.close_pools()

		async_to_sync(scenario)()


@skipUnless(RUN_REDIS_TESTS, 'Set RUN_REDIS_CHANNEL_TESTS=1 to run Redis integration tests')
@override_settings(
	CHANNEL_LAYERS=REDIS_TEST_CHANNEL_LAYERS,
	ALLOWED_HOSTS=['localhost', 'testserver'],
	SECRET_KEY='tests-only-secret-key-with-more-than-32-bytes',
	SIMPLE_JWT=TEST_SIMPLE_JWT,
)
class RedisWebSocketIntegrationTests(TransactionTestCase):
	def setUp(self):
		self.sender = User.objects.create_user(username='redis-sender', password='secret123')
		self.receiver = User.objects.create_user(username='redis-receiver', password='secret123')
		self.sender_token = str(RefreshToken.for_user(self.sender).access_token)
		self.receiver_token = str(RefreshToken.for_user(self.receiver).access_token)

	def _communicator(self, path, token):
		return WebsocketCommunicator(
			application,
			path,
			headers=[
				(b'origin', b'http://localhost:3000'),
				(b'cookie', f'access_token={token}'.encode()),
			],
		)

	def test_chat_typing_event_crosses_redis(self):
		async def scenario():
			sender = self._communicator('/ws/chat/', self.sender_token)
			receiver = self._communicator('/ws/chat/', self.receiver_token)
			try:
				self.assertTrue((await sender.connect())[0])
				self.assertTrue((await receiver.connect())[0])
				await sender.receive_json_from()
				await receiver.receive_json_from()

				await sender.send_json_to({
					'type': 'typing',
					'to_user_id': self.receiver.id,
					'to_user_login': self.receiver.username,
				})
				self.assertEqual(
					await receiver.receive_json_from(timeout=3),
					{
						'type': 'typing',
						'from_user_id': self.sender.id,
						'from_username': self.sender.username,
					},
				)
			finally:
				await sender.disconnect()
				await receiver.disconnect()

		async_to_sync(scenario)()

	def test_game_event_crosses_redis(self):
		async def scenario():
			communicator = self._communicator('/ws/games/', self.sender_token)
			try:
				self.assertTrue((await communicator.connect())[0])
				await communicator.receive_json_from()

				payload = {
					'type': 'game.event',
					'event': 'invitation.created',
					'match_id': 99,
					'match_status': 'pending',
					'occurred_at': '2026-08-04T12:00:00Z',
				}
				await get_channel_layer().group_send(
					user_realtime_group(self.sender.id),
					{'type': 'realtime_event', 'payload': payload},
				)
				self.assertEqual(await communicator.receive_json_from(timeout=3), payload)
			finally:
				await communicator.disconnect()

		async_to_sync(scenario)()
