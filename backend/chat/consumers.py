from channels.generic.websocket import AsyncWebsocketConsumer
import json
from django.contrib.auth.models import User
from asgiref.sync import sync_to_async

class DirectChatConsumer(AsyncWebsocketConsumer):
    
    async def connect(self):
        self.user = self.scope['user']
        self.user_group_name = f'user_{self.user.id}'
        
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        await self.accept()
        
        await self.send_friends_list()

    async def disconnect(self, close_code):
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

    async def handle_chat_message(self, data):
        to_user_id = data.get('to_user_id')
        message = data.get('message')
        timestamp = data.get('timestamp')
        
        recipient_group_name = f'user_{to_user_id}'
        
        await self.channel_layer.group_send(
            recipient_group_name,
            {
                'type': 'receive_message',
                'from_username': self.user.username,
                'from_user_id': self.user.id,
                'message': message,
                'timestamp': timestamp
            }
        )

    async def receive_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'from_user_id': event['from_user_id'],
            'from_username': event['from_username'],
            'message': event['message'],
            'timestamp': event['timestamp']
        }))

    async def send_friends_list(self):
        from users.services import get_or_create_friends_payload_for_user
        
        friends_data = await sync_to_async(get_or_create_friends_payload_for_user)(self.user)
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