from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0005_coalition_model_and_relation'),
    ]

    operations = [
        migrations.AddField(
            model_name='coalition',
            name='color',
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name='coalition',
            name='image_url',
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name='coalition',
            name='score',
            field=models.IntegerField(default=0),
        ),
    ]
