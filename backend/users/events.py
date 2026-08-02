from config.realtime import broadcast_realtime_event


def broadcast_friend_event(users, event_name, actor):
	profile = getattr(actor, 'campus_user_profile', None)
	actor_login = profile.login if profile else actor.username
	broadcast_realtime_event(
		{user.id for user in users},
		'friend.event',
		event_name,
		{'actor_login': actor_login},
	)
