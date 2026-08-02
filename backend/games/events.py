from config.realtime import broadcast_realtime_event


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
