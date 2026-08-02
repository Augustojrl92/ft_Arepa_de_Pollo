import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

# `auth.User.email` is not unique in Django. Validating uniqueness only in the
# serializer leaves a race between two concurrent registrations, so the rule is
# enforced by the database as well. The index is partial because campus users
# synced from 42 without an email address all share an empty string.
CREATE_EMAIL_INDEX = """
CREATE UNIQUE INDEX IF NOT EXISTS auth_user_email_ci_uniq
ON auth_user (LOWER(email))
WHERE email <> '';
"""

DROP_EMAIL_INDEX = "DROP INDEX IF EXISTS auth_user_email_ci_uniq;"


class Migration(migrations.Migration):

	dependencies = [
		migrations.swappable_dependency(settings.AUTH_USER_MODEL),
		('authentication', '0011_delete_fortytwoprofile'),
	]

	operations = [
		migrations.CreateModel(
			name='RegistrationInvite',
			fields=[
				('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
				('email', models.EmailField(max_length=255, unique=True)),
				('campus_login', models.CharField(help_text='CampusUser.login this invite grants access to.', max_length=255)),
				('note', models.CharField(blank=True, max_length=255)),
				('created_at', models.DateTimeField(auto_now_add=True)),
				('used_at', models.DateTimeField(blank=True, null=True)),
				('created_by', models.ForeignKey(
					blank=True,
					null=True,
					on_delete=django.db.models.deletion.SET_NULL,
					related_name='registration_invites_created',
					to=settings.AUTH_USER_MODEL,
				)),
			],
		),
		migrations.RunSQL(sql=CREATE_EMAIL_INDEX, reverse_sql=DROP_EMAIL_INDEX),
	]
