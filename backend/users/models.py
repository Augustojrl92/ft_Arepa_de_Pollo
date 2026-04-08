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

class Achievement(models.Model):
	slug = models.SlugField(max_length=100, unique=True, null=True, blank=True)
	title = models.CharField(max_length=255)
	description = models.TextField(blank=True)
	icon = models.CharField(max_length=255)

	def __str__(self):
		return self.title

class UserAchievementList(models.Model):
	owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='user_achievement_list')
	completed_achievements = models.ManyToManyField('Achievement', related_name='completed_by_users', blank=True)
	in_progress_achievements = models.ManyToManyField('Achievement', related_name='in_progress_by_users', blank=True)

	def __str__(self):
		login = getattr(getattr(self.owner, 'campus_user_profile', None), 'login', None)
		identifier = login or self.owner.username
		return f'Achievements of [{identifier}]'


class AchievementEvent(models.Model):
	EVENT_COMPLETED = 'achievement.completed'
	EVENT_TYPES = (
		(EVENT_COMPLETED, 'Achievement completed'),
	)

	owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='achievement_events')
	achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name='achievement_events')
	event_type = models.CharField(max_length=64, choices=EVENT_TYPES)
	payload = models.JSONField(default=dict, blank=True)
	delivered_at = models.DateTimeField(null=True, blank=True)
	created_at = models.DateTimeField(auto_now_add=True)

	def __str__(self):
		return f'{self.event_type} -> {self.owner_id}'
