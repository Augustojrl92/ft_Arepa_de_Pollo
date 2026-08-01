from django.conf import settings
from django.db import models


class GameMatch(models.Model):
	class Status(models.TextChoices):
		PENDING = 'pending', 'Pending'
		ACTIVE = 'active', 'Active'
		DECLINED = 'declined', 'Declined'
		CANCELLED = 'cancelled', 'Cancelled'
		COMPLETED = 'completed', 'Completed'

	inviter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='game_matches_invited')
	opponent = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='game_matches_received')
	status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
	target_score = models.PositiveSmallIntegerField(default=3)
	inviter_score = models.PositiveSmallIntegerField(default=0)
	opponent_score = models.PositiveSmallIntegerField(default=0)
	winner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='game_matches_won')
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)
	accepted_at = models.DateTimeField(null=True, blank=True)
	completed_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		ordering = ['-updated_at']


class GameRound(models.Model):
	CHOICES = [
		('rock', 'Rock'),
		('paper', 'Paper'),
		('scissors', 'Scissors'),
		('lizard', 'Lizard'),
		('spock', 'Spock'),
	]

	match = models.ForeignKey(GameMatch, on_delete=models.CASCADE, related_name='rounds')
	number = models.PositiveSmallIntegerField()
	inviter_choice = models.CharField(max_length=10, choices=CHOICES, null=True, blank=True)
	opponent_choice = models.CharField(max_length=10, choices=CHOICES, null=True, blank=True)
	winner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='game_rounds_won')
	verb = models.CharField(max_length=24, blank=True)
	resolved_at = models.DateTimeField(null=True, blank=True)

	class Meta:
		ordering = ['number']
		constraints = [
			models.UniqueConstraint(fields=['match', 'number'], name='unique_round_number_per_match'),
		]
