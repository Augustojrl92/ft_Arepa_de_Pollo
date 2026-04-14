from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

	dependencies = [
		('sync', '0013_campususer_projects_delivered_stats'),
	]

	operations = [
		migrations.CreateModel(
			name='CoalitionProjectCursor',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('last_score_id', models.PositiveBigIntegerField(blank=True, null=True)),
				('last_score_created_at', models.DateTimeField(blank=True, null=True)),
				('last_synced_at', models.DateTimeField(auto_now=True)),
				('coalition', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='project_cursor', to='sync.coalition')),
			],
		),
	]
