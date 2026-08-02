from django.db import models
from sync.models import CampusUser

# Create your models here.
class Message(models.Model):
	sender = models.ForeignKey(CampusUser, on_delete=models.CASCADE, related_name='sent_messages')
	receiver = models.ForeignKey(CampusUser, on_delete=models.CASCADE, related_name='received_messages')

	message = models.TextField(null=False)
	date_time = models.DateTimeField(null=False)
