from django.db import migrations, models


def link_campus_users_to_django_users(apps, schema_editor):
	CampusUser = apps.get_model('sync', 'CampusUser')
	User = apps.get_model('auth', 'User')

	assigned_user_ids = set(
		CampusUser.objects.exclude(django_user_id__isnull=True).values_list('django_user_id', flat=True)
	)

	for campus_user in CampusUser.objects.filter(django_user_id__isnull=True).order_by('id'):
		candidate = None

		if campus_user.login:
			candidate = User.objects.filter(username=campus_user.login).first()

		if candidate is None and campus_user.email:
			candidate = User.objects.filter(email=campus_user.email).first()

		if candidate is None:
			continue

		if candidate.id in assigned_user_ids:
			continue

		campus_user.django_user_id = candidate.id
		campus_user.save(update_fields=['django_user'])
		assigned_user_ids.add(candidate.id)


class Migration(migrations.Migration):

	dependencies = [
		('auth', '0012_alter_user_first_name_max_length'),
		('sync', '0005_coalition'),
	]

	operations = [
		migrations.AddField(
			model_name='campususer',
			name='django_user',
			field=models.OneToOneField(blank=True, null=True, on_delete=models.SET_NULL, related_name='campus_user_profile', to='auth.user'),
		),
		migrations.RunPython(link_campus_users_to_django_users, migrations.RunPython.noop),
	]
