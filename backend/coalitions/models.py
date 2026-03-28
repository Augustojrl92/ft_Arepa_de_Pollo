from django.db import models


class Coalition(models.Model):
	intra_id = models.PositiveBigIntegerField(unique=True, null=True, blank=True)
	name = models.CharField(max_length=255, unique=True)
	slug = models.SlugField(max_length=255, unique=True)
	color = models.CharField(max_length=32, blank=True)
	image_url = models.URLField(max_length=500, blank=True)
	score = models.IntegerField(default=0)

	class Meta:
		db_table = "authentication_coalition"

	def __str__(self):
		return self.name
