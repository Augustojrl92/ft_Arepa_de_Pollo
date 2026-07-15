from django.conf import settings
from django.db import models

from sync.models import CampusUser
from .achievement_functions import *

class FriendsList(models.Model):
	owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='friends_list')
	friends = models.ManyToManyField('self', symmetrical=True, blank=True)
	friends_requests_received = models.ManyToManyField('self', symmetrical=False, related_name='friend_request_targets', blank=True)
	friends_requests_sent = models.ManyToManyField('self', symmetrical=False, related_name='friend_request_sources', blank=True)

	def __str__(self):
		login = getattr(getattr(self.owner, 'campus_user_profile', None), 'login', None)
		identifier = login or self.owner.username
		return f'[{identifier}]'

class UserPreferences(models.Model):
	user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='preferences')
	custom_avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
	items_per_page = models.PositiveIntegerField(default=10)
	show_sensitive_data = models.BooleanField(default=True)
	theme_mode = models.CharField(max_length=20, default='dark')
	receive_notifications = models.BooleanField(default=True)
	custom_username = models.CharField(max_length=150, blank=True, null=True)

	def __str__(self):
		login = getattr(getattr(self.user, 'campus_user_profile', None), 'login', None)
		identifier = login or self.user.username
		return f'Preferences for [{identifier}]'

# Pongo esta clase aqui a falta de archivos más apropiados y ya que los logros respectan a los usuarios
class Achievement(models.Model):
	def __init__(self, *args, **kwargs):
		super().__init__(args, kwargs)

		# Insert achievement completion check functions below: 🠳🠳🠳
		self.completion_check_funcs['Dios de las arepas'] = dios_de_las_arepas_completion_check # Augusto no me odies por esto


	# HTML for the achievement icon to be inserted into the page. The default value is a copy of the html of the div of a mock up icon
	icon_HTML = models.TextField(default='<div class="inline-flex rounded-lg border border-border bg-card p-2"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-medal h-5 w-5 text-(--coalition-color)"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"></path><path d="M11 12 5.12 2.2"></path><path d="m13 12 5.88-9.8"></path><path d="M8 7h8"></path><circle cx="12" cy="17" r="5"></circle><path d="M12 18v-2h-.5"></path></svg></div>')
	name = models.TextField(default='Dios de las arepas')
	description = models.TextField(default='Has diseñado la Arepacendence definitiva')

	# Points needed for completion of the achivement, it may be a percentage (set to 100), a bool (set to 1), or any arbitrary number
	completion_points = models.PositiveIntegerField(default=1)

	# Key value for achievement and a function that inputs a UserAchievement row and returns True or False depending on whether that login has completed the achievement
	# The key is the field name for the achievement
	# To add the function just do inside __init__: self.completion_check_funcs['achievement_name'] = function_name
	# Remember to return True or False and set the progress value from UserAchievement only if completion_date == None else return True
	completion_check_funcs = dict()

class UserAchievement(models.Model):
	user = models.OneToOneField(CampusUser, on_delete=models.CASCADE)
	achievement = models.OneToOneField(Achievement, on_delete=models.CASCADE)
	progress = models.PositiveIntegerField(default=0)

	# If not null it is completed and no extra check with the achievement is needed
	completion_date = models.DateTimeField(null=True)
