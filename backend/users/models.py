from django.conf import settings
from django.db import models

class FriendsList(models.Model):
	owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='friends_list')
	friends = models.ManyToManyField('self', symmetrical=True, blank=True)
	friends_requests_received = models.ManyToManyField('self', symmetrical=False, related_name='friend_request_targets', blank=True)
	friends_requests_sent = models.ManyToManyField('self', symmetrical=False, related_name='friend_request_sources', blank=True)

	def __str__(self):
		login = getattr(getattr(self.owner, 'campus_user_profile', None), 'login', None)
		identifier = login or self.owner.username
		return f'[{identifier}]'
