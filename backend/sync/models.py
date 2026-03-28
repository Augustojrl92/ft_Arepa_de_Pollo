from django.db import models


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


class CampusUser(models.Model):
	# IDs principales
	intra_id = models.PositiveBigIntegerField(unique=True)
	user_id = models.PositiveBigIntegerField()

	# Datos de progreso en el cursus
	grade = models.CharField(max_length=64, blank=True)
	level = models.DecimalField(max_digits=6, decimal_places=2, default=0)

	# Datos del usuario embebido en la respuesta
	login = models.CharField(max_length=255, blank=True)
	email = models.EmailField(max_length=255, blank=True)
	display_name = models.CharField(max_length=255, blank=True)
	avatar_url = models.URLField(max_length=500, blank=True)
	wallet = models.IntegerField(default=0)
	correction_points = models.IntegerField(default=0)
	pool_month = models.CharField(max_length=30, blank=True)
	pool_year = models.PositiveIntegerField(null=True, blank=True)
	is_active = models.BooleanField(default=True)

	# Coalicion
	coalition_id = models.PositiveIntegerField(null=True, blank=True)
	coalition_name = models.CharField(max_length=255, blank=True)
	coalition_slug = models.CharField(max_length=255, blank=True)
	coalition_user_score = models.IntegerField(default=0)
	coalition_total_score = models.IntegerField(default=0)

	# Timestamps del registro de cursus_users
	created_at = models.DateTimeField()
	updated_at = models.DateTimeField()

	class Meta:
		unique_together = ('intra_id', 'user_id')

	def __str__(self):
		return f'{self.login} - {self.coalition_name or "Sin coalición"}'