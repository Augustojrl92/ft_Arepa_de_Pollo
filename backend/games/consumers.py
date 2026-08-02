from channels.generic.websocket import AsyncJsonWebsocketConsumer

from config.realtime import user_realtime_group


class GameConsumer(AsyncJsonWebsocketConsumer):
	async def connect(self):
		user = self.scope.get('user')
		if not user or not user.is_authenticated:
			await self.close(code=4401)
			return

		self.user_group = user_realtime_group(user.id)
		await self.channel_layer.group_add(self.user_group, self.channel_name)
		await self.accept()
		await self.send_json({'type': 'game.connected'})

	async def disconnect(self, _close_code):
		if hasattr(self, 'user_group'):
			await self.channel_layer.group_discard(self.user_group, self.channel_name)

	async def receive_json(self, content, **_kwargs):
		if content.get('type') == 'ping':
			await self.send_json({'type': 'pong'})
			return
		await self.send_json({'type': 'game.error', 'error': 'Unsupported message type'})

	async def realtime_event(self, event):
		await self.send_json(event['payload'])
