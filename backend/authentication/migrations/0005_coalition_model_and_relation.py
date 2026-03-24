from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


def migrate_coalition_strings_to_relation(apps, schema_editor):
    Coalition = apps.get_model('authentication', 'Coalition')
    FortyTwoProfile = apps.get_model('authentication', 'FortyTwoProfile')

    for profile in FortyTwoProfile.objects.exclude(coalition_old__isnull=True).exclude(coalition_old=''):
        coalition_name = profile.coalition_old.strip()
        coalition_slug = slugify(coalition_name)
        if not coalition_slug:
            continue

        coalition, _ = Coalition.objects.get_or_create(
            slug=coalition_slug,
            defaults={'name': coalition_name},
        )
        if coalition.name != coalition_name:
            coalition.name = coalition_name
            coalition.save(update_fields=['name'])

        profile.coalition_new = coalition
        profile.save(update_fields=['coalition_new'])


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0004_fortytwoprofile_eval_points'),
    ]

    operations = [
        migrations.CreateModel(
            name='Coalition',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('intra_id', models.PositiveBigIntegerField(blank=True, null=True, unique=True)),
                ('name', models.CharField(max_length=255, unique=True)),
                ('slug', models.SlugField(max_length=255, unique=True)),
            ],
        ),
        migrations.RenameField(
            model_name='fortytwoprofile',
            old_name='coalition',
            new_name='coalition_old',
        ),
        migrations.AddField(
            model_name='fortytwoprofile',
            name='coalition_new',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='members', to='authentication.coalition'),
        ),
        migrations.RunPython(migrate_coalition_strings_to_relation, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='fortytwoprofile',
            name='coalition_old',
        ),
        migrations.RenameField(
            model_name='fortytwoprofile',
            old_name='coalition_new',
            new_name='coalition',
        ),
    ]
