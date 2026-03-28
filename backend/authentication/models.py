from django.db import models
from django.contrib.auth.models import User


class FortyTwoProfile(models.Model):
	user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='forty_two_profile', null=True, blank=True)
	intra_id = models.PositiveBigIntegerField(unique=True)
	intra_level = models.DecimalField(max_digits=5, decimal_places=2)
	intra_wallet = models.IntegerField()
	eval_points = models.IntegerField(default=0)
	login = models.CharField(max_length=255, unique=True)
	display_name = models.CharField(max_length=255)
	email = models.EmailField(max_length=255, unique=True)
	avatar_url = models.URLField(max_length=500)
	coalition = models.ForeignKey('coalitions.Coalition', on_delete=models.SET_NULL, related_name='members', null=True, blank=True)
	coalition_user_score = models.PositiveIntegerField(default=0)
	campus_user_rank = models.PositiveIntegerField(null=True, blank=True)
	coalition_user_rank = models.PositiveIntegerField(null=True, blank=True)

	def __str__(self):
		return self.login
