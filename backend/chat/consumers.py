import json
from datetime import datetime

from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

from sync.models import CampusUser
from .models import Message

class DirectChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.user = self.scope['user']

        if not getattr(self.user, 'is_authenticated', False):
            await self.close(code=4401)
            return

        self.user_group_name = f'user_{self.user.id}'

        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        await self.accept()

        await self.send_friends_list()

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')

        if message_type == 'chat_message':
            await self.handle_chat_message(data)
        elif message_type == 'refresh_friends':
            await self.send_friends_list()

    @database_sync_to_async
    def _save_message(self, sender_login, recipient_login, message_text):
        sender_user = CampusUser.objects.filter(login=sender_login).first()
        recipient_user = CampusUser.objects.filter(login=recipient_login).first()

        if sender_user is None or recipient_user is None:
            return None

        return Message.objects.create(
            sender=sender_user,
            receiver=recipient_user,
            message=message_text,
            date_time=datetime.now(),
        )

    async def handle_chat_message(self, data):
        sender_login = self.user.get_username()
        recipient_login = data.get('to_user_login')
        to_user_id = data.get('to_user_id')
        message = data.get('message')
        timestamp = data.get('timestamp')

        if not recipient_login or not message:
            return

        saved_message = await self._save_message(sender_login, recipient_login, message)
        if saved_message is None:
            return

        recipient_group_name = f'user_{to_user_id}'

        await self.channel_layer.group_send(
            recipient_group_name,
            {
                'type': 'receive_message',
                'from_username': self.user.username,
                'from_user_id': self.user.id,
                'message': message,
                'timestamp': timestamp,
            }
        )

    async def receive_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'from_user_id': event['from_user_id'],
            'from_username': event['from_username'],
            'message': event['message'],
            'timestamp': event['timestamp'],
        }))

    async def send_friends_list(self):
        from users.services import get_or_create_friends_payload_for_user
        friends_data = await database_sync_to_async(get_or_create_friends_payload_for_user)(self.user)
        await self.send(text_data=json.dumps({
            'type': 'friends_list',
            'friends': friends_data
        }))

    async def friend_status_changed(self, event):
        await self.send(text_data=json.dumps({
            'type': 'status_update',
            'user_id': event['user_id'],
            'status': event['status']
        }))