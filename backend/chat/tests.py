from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import User
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import RefreshToken

from config.asgi import application


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
class ChatWebSocketTests(TransactionTestCase):
    def setUp(self):
        self.sender = User.objects.create_user(username='sender', password='secret123')
        self.receiver = User.objects.create_user(username='receiver', password='secret123')

    def _communicator_for(self, token):
        return WebsocketCommunicator(
            application,
            '/ws/chat/',
            headers=[
                (b'origin', b'http://localhost:3000'),
                (b'cookie', f'access_token={token}'.encode()),
            ],
        )

    def test_typing_event_is_forwarded_to_recipient(self):
        sender_token = str(RefreshToken.for_user(self.sender).access_token)
        receiver_token = str(RefreshToken.for_user(self.receiver).access_token)

        async def scenario():
            sender = self._communicator_for(sender_token)
            receiver = self._communicator_for(receiver_token)

            sender_connected, _sender_detail = await sender.connect()
            receiver_connected, _receiver_detail = await receiver.connect()
            self.assertTrue(sender_connected)
            self.assertTrue(receiver_connected)

            await sender.receive_json_from()
            await receiver.receive_json_from()

            await sender.send_json_to({
                'type': 'typing',
                'to_user_id': self.receiver.id,
                'to_user_login': self.receiver.username,
            })

            self.assertEqual(
                await receiver.receive_json_from(),
                {
                    'type': 'typing',
                    'from_user_id': self.sender.id,
                    'from_username': self.sender.username,
                },
            )

            await sender.disconnect()
            await receiver.disconnect()

        async_to_sync(scenario)()
