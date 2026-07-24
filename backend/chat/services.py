
from datetime import datetime

from sync.models import CampusUser
from .models import Message

'''Return list[{sender, message, datetime}]'''
def get_messages_between(login1: str, login2: str) -> list[{str, str, datetime}] | None:
	if login1 == login2:
		return None
	user1 = CampusUser.objects.filter(login=login1)
	user2 = CampusUser.objects.filter(login=login2)

	message_rows = list(Message.objects.filter((Q(sender=user1) & Q(receiver=user2)) | (Q(sender=user2) & Q(receiver=user1))).iterator())
	output = [{row.sender, row.message, row.date_time} for row in message_rows]
	return output

def message_sent(sender_login: str, receiver_login: str, message: str):
	to_add = Message(sender=sender_login, receiver=receiver_login, message=message, date_time=datetime.now())
	to_add.save()

