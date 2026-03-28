from django.db import migrations, models


class Migration(migrations.Migration):
	initial = True

	dependencies = [
		('authentication', '0008_profile_campus_user_rank'),
	]

	operations = [
		migrations.SeparateDatabaseAndState(
			state_operations=[
				migrations.CreateModel(
					name='Coalition',
					fields=[
						('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
						('intra_id', models.PositiveBigIntegerField(blank=True, null=True, unique=True)),
						('name', models.CharField(max_length=255, unique=True)),
						('slug', models.SlugField(max_length=255, unique=True)),
						('color', models.CharField(blank=True, max_length=32)),
						('image_url', models.URLField(blank=True, max_length=500)),
						('score', models.IntegerField(default=0)),
					],
					options={
						'db_table': 'authentication_coalition',
					},
				),
			],
			database_operations=[],
		),
	]
