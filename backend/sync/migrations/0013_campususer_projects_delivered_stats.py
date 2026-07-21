from django.db import migrations, models


class Migration(migrations.Migration):

	dependencies = [
		('sync', '0012_syncmetadata'),
	]

	operations = [
		migrations.AddField(
			model_name='campususer',
			name='projects_delivered_current_season',
			field=models.PositiveIntegerField(default=0),
		),
		migrations.AddField(
			model_name='campususer',
			name='projects_delivered_synced_at',
			field=models.DateTimeField(blank=True, null=True),
		),
		migrations.AddField(
			model_name='campususer',
			name='projects_delivered_total',
			field=models.PositiveIntegerField(default=0),
		),
	]
