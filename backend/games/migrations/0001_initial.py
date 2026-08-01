from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
	initial = True

	dependencies = [
		migrations.swappable_dependency(settings.AUTH_USER_MODEL),
	]

	operations = [
		migrations.CreateModel(
			name='GameMatch',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('status', models.CharField(choices=[('pending', 'Pending'), ('active', 'Active'), ('declined', 'Declined'), ('cancelled', 'Cancelled'), ('completed', 'Completed')], default='pending', max_length=16)),
				('target_score', models.PositiveSmallIntegerField(default=3)),
				('inviter_score', models.PositiveSmallIntegerField(default=0)),
				('opponent_score', models.PositiveSmallIntegerField(default=0)),
				('created_at', models.DateTimeField(auto_now_add=True)),
				('updated_at', models.DateTimeField(auto_now=True)),
				('accepted_at', models.DateTimeField(blank=True, null=True)),
				('completed_at', models.DateTimeField(blank=True, null=True)),
				('inviter', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='game_matches_invited', to=settings.AUTH_USER_MODEL)),
				('opponent', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='game_matches_received', to=settings.AUTH_USER_MODEL)),
				('winner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='game_matches_won', to=settings.AUTH_USER_MODEL)),
			],
			options={'ordering': ['-updated_at']},
		),
		migrations.CreateModel(
			name='GameRound',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('number', models.PositiveSmallIntegerField()),
				('inviter_choice', models.CharField(blank=True, choices=[('rock', 'Rock'), ('paper', 'Paper'), ('scissors', 'Scissors'), ('lizard', 'Lizard'), ('spock', 'Spock')], max_length=10, null=True)),
				('opponent_choice', models.CharField(blank=True, choices=[('rock', 'Rock'), ('paper', 'Paper'), ('scissors', 'Scissors'), ('lizard', 'Lizard'), ('spock', 'Spock')], max_length=10, null=True)),
				('verb', models.CharField(blank=True, max_length=24)),
				('resolved_at', models.DateTimeField(blank=True, null=True)),
				('match', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='rounds', to='games.gamematch')),
				('winner', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='game_rounds_won', to=settings.AUTH_USER_MODEL)),
			],
			options={
				'ordering': ['number'],
				'constraints': [models.UniqueConstraint(fields=('match', 'number'), name='unique_round_number_per_match')],
			},
		),
	]
