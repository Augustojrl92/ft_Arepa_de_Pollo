from django.db import migrations, models


class Migration(migrations.Migration):

	dependencies = [
		('sync', '0013_campususer_evaluations_done_total_and_more'),
	]

	operations = [
		migrations.AddField(
			model_name='campususer',
			name='evaluations_synced_at',
			field=models.DateTimeField(blank=True, null=True),
		),
	]
