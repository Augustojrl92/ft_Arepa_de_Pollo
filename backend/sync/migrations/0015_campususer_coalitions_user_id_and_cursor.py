from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

	dependencies = [
		('sync', '0014_campususer_evaluations_synced_at'),
	]

	operations = [
		migrations.AddField(
			model_name='campususer',
			name='coalitions_user_id',
			field=models.PositiveBigIntegerField(blank=True, db_index=True, null=True),
		),
		migrations.CreateModel(
			name='CoalitionEvaluationCursor',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('last_score_id', models.PositiveBigIntegerField(blank=True, null=True)),
				('last_score_created_at', models.DateTimeField(blank=True, null=True)),
				('last_synced_at', models.DateTimeField(auto_now=True)),
				('coalition', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='evaluation_cursor', to='sync.coalition')),
			],
		),
	]
