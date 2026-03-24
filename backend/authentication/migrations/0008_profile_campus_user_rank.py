from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0007_profile_coalition_user_stats'),
    ]

    operations = [
        migrations.AddField(
            model_name='fortytwoprofile',
            name='campus_user_rank',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
    ]
