from django.db import migrations, models


class Migration(migrations.Migration):

	dependencies = [
		('sync', '0014_coalitionprojectcursor'),
	]

	operations = [
		migrations.AddField(
			model_name='coalition',
			name='exams_validated_current_season',
			field=models.PositiveIntegerField(default=0),
		),
	]
