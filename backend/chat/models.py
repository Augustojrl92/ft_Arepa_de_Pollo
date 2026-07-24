from django.db import models

# Create your models here.
class Message(models.Model):
	sender = models.ForeignKey(CampusUser, on_delete=models.CASCADE)
	receiver = models.ForeignKey(CampusUser, on_delete=models.CASCADE)

	message = models.TextField(null=False)
	date_time = models.DateTimeField(null=False)
