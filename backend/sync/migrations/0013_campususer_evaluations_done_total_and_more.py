from django.db import migrations, models


class Migration(migrations.Migration):

	dependencies = [
		('sync', '0012_syncmetadata'),
	]

	operations = [
		migrations.AddField(
			model_name='campususer',
			name='evaluations_done_total',
			field=models.PositiveIntegerField(default=0),
		),
		migrations.AddField(
			model_name='campususer',
			name='evaluations_done_current_season',
			field=models.PositiveIntegerField(default=0),
		),
	]
