from django.db import models
from django.contrib.auth.models import User


class Coalition(models.Model):
	coalition_id = models.PositiveIntegerField(unique=True)
	name = models.CharField(max_length=255)
	slug = models.CharField(max_length=255, blank=True)
	image_url = models.URLField(max_length=500, blank=True)
	cover_url = models.URLField(max_length=500, blank=True)
	color = models.CharField(max_length=20, blank=True)
	total_score = models.IntegerField(default=0)
	leader_user_id = models.PositiveBigIntegerField(null=True, blank=True)
	updated_at = models.DateTimeField(auto_now=True)

	def __str__(self):
		return f'{self.name} ({self.coalition_id})'


class CoalitionScoreSnapshot(models.Model):
	coalition = models.ForeignKey(Coalition, on_delete=models.CASCADE, related_name='score_snapshots')
	snapshot_date = models.DateField()
	total_score = models.IntegerField(default=0)
	campus_rank = models.PositiveIntegerField(null=True, blank=True)
	captured_at = models.DateTimeField(auto_now=True)

	class Meta:
		unique_together = ('coalition', 'snapshot_date')
		indexes = [
			models.Index(fields=['coalition', 'snapshot_date']),
		]

	def __str__(self):
		return f'{self.coalition.name} - {self.snapshot_date}: {self.total_score}'


class CampusUser(models.Model):
	django_user = models.OneToOneField(User, on_delete=models.SET_NULL, related_name='campus_user_profile', null=True, blank=True)

	# IDs principales
	intra_id = models.PositiveBigIntegerField(unique=True)
	user_id = models.PositiveBigIntegerField()

	# Datos de progreso en el cursus
	grade = models.CharField(max_length=64, blank=True)
	level = models.DecimalField(max_digits=8, decimal_places=2, default=0)

	# Datos del usuario embebido en la respuesta
	login = models.CharField(max_length=255, blank=True)
	email = models.EmailField(max_length=255, blank=True)
	display_name = models.CharField(max_length=255, blank=True)
	avatar_url = models.URLField(max_length=500, blank=True)
	wallet = models.IntegerField(default=0)
	correction_points = models.IntegerField(default=0)
	projects_delivered_total = models.PositiveIntegerField(default=0)
	projects_delivered_current_season = models.PositiveIntegerField(default=0)
	projects_delivered_synced_at = models.DateTimeField(null=True, blank=True)
	pool_month = models.CharField(max_length=30, blank=True)
	pool_year = models.PositiveIntegerField(null=True, blank=True)
	is_active = models.BooleanField(default=True)

	# Coalicion
	coalition_id = models.PositiveIntegerField(null=True, blank=True)
	coalition_name = models.CharField(max_length=255, blank=True)
	coalition_slug = models.CharField(max_length=255, blank=True)
	coalition_user_score = models.IntegerField(default=0)
	coalition_rank = models.PositiveIntegerField(null=True, blank=True)
	general_rank = models.PositiveIntegerField(null=True, blank=True)

	# Timestamps del registro de cursus_users
	created_at = models.DateTimeField()
	updated_at = models.DateTimeField()

	class Meta:
		unique_together = ('intra_id', 'user_id')

	def __str__(self):
		return f'{self.login} - {self.coalition_name or "Sin coalición"}'


class CampusUserScoreSnapshot(models.Model):
	campus_user = models.ForeignKey(CampusUser, on_delete=models.CASCADE, related_name='score_snapshots')
	snapshot_date = models.DateField()
	coalition_user_score = models.IntegerField(default=0)
	coalition_user_rank = models.PositiveIntegerField(null=True, blank=True)
	campus_user_rank = models.PositiveIntegerField(null=True, blank=True)
	captured_at = models.DateTimeField(auto_now=True)

	class Meta:
		unique_together = ('campus_user', 'snapshot_date')
		indexes = [
			models.Index(fields=['campus_user', 'snapshot_date']),
		]

	def __str__(self):
		return f'{self.campus_user.login} - {self.snapshot_date}: {self.coalition_user_score}'


class SyncMetadata(models.Model):
	key = models.CharField(max_length=64, unique=True)
	last_time_update = models.DateTimeField(null=True, blank=True)

	def __str__(self):
		return f'{self.key}: {self.last_time_update}'
