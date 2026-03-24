from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0006_coalition_stats_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='fortytwoprofile',
            name='coalition_user_rank',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='fortytwoprofile',
            name='coalition_user_score',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
