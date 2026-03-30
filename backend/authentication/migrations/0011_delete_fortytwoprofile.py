from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0010_merge_20260330_1307'),
    ]

    operations = [
        migrations.DeleteModel(
            name='FortyTwoProfile',
        ),
    ]
