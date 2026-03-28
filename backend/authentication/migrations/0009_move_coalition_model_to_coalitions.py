import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

	dependencies = [
		('authentication', '0008_profile_campus_user_rank'),
		('coalitions', '0001_initial'),
	]

	operations = [
		migrations.SeparateDatabaseAndState(
			state_operations=[
				migrations.AlterField(
					model_name='fortytwoprofile',
					name='coalition',
					field=models.ForeignKey(
						blank=True,
						null=True,
						on_delete=django.db.models.deletion.SET_NULL,
						related_name='members',
						to='coalitions.coalition',
					),
				),
				migrations.DeleteModel(
					name='Coalition',
				),
			],
			database_operations=[],
		),
	]
