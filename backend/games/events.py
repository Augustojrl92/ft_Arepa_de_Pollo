import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone


logger = logging.getLogger(__name__)


def game_user_group(user_id):
	return f'games.user.{user_id}'


def broadcast_game_event(match, event_name):
	"""Notify both players without placing private move data on the socket."""
	channel_layer = get_channel_layer()
	if channel_layer is None:
		logger.warning('Game event %s skipped because no channel layer is configured.', event_name)
		return

	payload = {
		'type': 'game.event',
		'event': event_name,
		'match_id': match.id,
		'match_status': match.status,
		'occurred_at': timezone.now().isoformat(),
	}
	for user_id in {match.inviter_id, match.opponent_id}:
		try:
			async_to_sync(channel_layer.group_send)(
				game_user_group(user_id),
				{'type': 'game_event', 'payload': payload},
			)
		except Exception:
			logger.exception('Could not broadcast game event %s to user %s.', event_name, user_id)
