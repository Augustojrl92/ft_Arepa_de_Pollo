# Generated manually on 2026-04-01

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('sync', '0009_remove_campususer_coalition_total_score_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='CoalitionScoreSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('snapshot_date', models.DateField()),
                ('total_score', models.IntegerField(default=0)),
                ('campus_rank', models.PositiveIntegerField(blank=True, null=True)),
                ('captured_at', models.DateTimeField(auto_now=True)),
                ('coalition', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='score_snapshots', to='sync.coalition')),
            ],
            options={
                'unique_together': {('coalition', 'snapshot_date')},
            },
        ),
        migrations.CreateModel(
            name='CampusUserScoreSnapshot',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('snapshot_date', models.DateField()),
                ('coalition_user_score', models.IntegerField(default=0)),
                ('coalition_user_rank', models.PositiveIntegerField(blank=True, null=True)),
                ('campus_user_rank', models.PositiveIntegerField(blank=True, null=True)),
                ('captured_at', models.DateTimeField(auto_now=True)),
                ('campus_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='score_snapshots', to='sync.campususer')),
            ],
            options={
                'unique_together': {('campus_user', 'snapshot_date')},
            },
        ),
        migrations.AddIndex(
            model_name='coalitionscoresnapshot',
            index=models.Index(fields=['coalition', 'snapshot_date'], name='sync_coalit_coalit_aa8c59_idx'),
        ),
        migrations.AddIndex(
            model_name='campususerscoresnapshot',
            index=models.Index(fields=['campus_user', 'snapshot_date'], name='sync_campu_campus__930463_idx'),
        ),
    ]
