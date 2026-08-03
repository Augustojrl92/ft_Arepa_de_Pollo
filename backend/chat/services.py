from datetime import datetime
from django.db.models import Q, Max

from sync.models import CampusUser
from .models import Message

def get_conversations_for_user(login: str) -> list[dict]:
	me = CampusUser.objects.filter(login=login).first()
	if me is None:
		return []

	messages = (
		Message.objects
		.filter(Q(sender=me) | Q(receiver=me))
		.select_related('sender', 'receiver', 'sender__django_user', 'receiver__django_user')
		.order_by('-date_time')
	)

	conversations_by_partner = {}

	for msg in messages:
		partner = msg.receiver if msg.sender_id == me.id else msg.sender

		if partner.id in conversations_by_partner:
			continue

		partner_conversation_id = partner.django_user_id if partner.django_user_id is not None else partner.id

		conversations_by_partner[partner.id] = {
			'id': partner_conversation_id,
			'login': partner.login,
			'name': partner.display_name or partner.login,
			'last_message': msg.message,
			'last_time': msg.date_time.isoformat(),
		}

	return list(conversations_by_partner.values())

def get_messages_between(login1: str, login2: str) -> list[dict] | None:
	if login1 == login2:
		return None

	user1 = CampusUser.objects.filter(login=login1).first()
	user2 = CampusUser.objects.filter(login=login2).first()

	if user1 is None or user2 is None:
		return None

	message_rows = (
		Message.objects
		.filter((Q(sender=user1) & Q(receiver=user2)) | (Q(sender=user2) & Q(receiver=user1)))
		.order_by('date_time')
		.select_related('sender', 'receiver')
	)

	return [
		{
			'sender_login': row.sender.login,
			'receiver_login': row.receiver.login,
			'message': row.message,
			'date_time': row.date_time.isoformat(),
		}
		for row in message_rows
	]