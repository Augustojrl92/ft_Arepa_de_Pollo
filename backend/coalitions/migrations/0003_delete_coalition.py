from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0011_delete_fortytwoprofile'),
        ('coalitions', '0002_coalition_cover_url'),
    ]

    operations = [
        migrations.DeleteModel(
            name='Coalition',
        ),
    ]
