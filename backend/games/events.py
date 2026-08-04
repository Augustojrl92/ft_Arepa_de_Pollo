from config.realtime import broadcast_realtime_event
from django.db.models import Q

from .models import GameMatch


def broadcast_game_event(match, event_name):
	"""Notify both players without placing private move data on the socket."""
	broadcast_realtime_event(
		{match.inviter_id, match.opponent_id},
		'game.event',
		event_name,
		{
		'match_id': match.id,
		'match_status': match.status,
		},
	)


def broadcast_game_availability(user_ids):
	"""Refresh every pending invitation affected by players becoming busy or free."""
	pending_matches = GameMatch.objects.filter(status=GameMatch.Status.PENDING).filter(
		Q(inviter_id__in=user_ids) | Q(opponent_id__in=user_ids)
	)
	for pending_match in pending_matches:
		broadcast_game_event(pending_match, 'invitation.availability_changed')
