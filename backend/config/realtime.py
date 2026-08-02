import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.utils import timezone


logger = logging.getLogger(__name__)


def user_realtime_group(user_id):
	return f'realtime.user.{user_id}'


def broadcast_realtime_event(user_ids, event_type, event_name, data=None):
	channel_layer = get_channel_layer()
	if channel_layer is None:
		logger.warning('Realtime event %s skipped because no channel layer is configured.', event_name)
		return

	payload = {
		'type': event_type,
		'event': event_name,
		'occurred_at': timezone.now().isoformat(),
		**(data or {}),
	}
	for user_id in set(user_ids):
		try:
			async_to_sync(channel_layer.group_send)(
				user_realtime_group(user_id),
				{'type': 'realtime_event', 'payload': payload},
			)
		except Exception:
			logger.exception('Could not broadcast realtime event %s to user %s.', event_name, user_id)
