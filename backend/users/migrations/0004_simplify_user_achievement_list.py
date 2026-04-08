from django.conf import settings
from django.db import migrations, models


def copy_user_achievement_states(apps, schema_editor):
    UserAchievementList = apps.get_model('users', 'UserAchievementList')
    UserAchievement = apps.get_model('users', 'UserAchievement')

    for user_achievement in UserAchievement.objects.select_related('achievement').all():
        user_list, _created = UserAchievementList.objects.get_or_create(owner_id=user_achievement.owner_id)

        if user_achievement.status == 'completed':
            user_list.completed_achievements.add(user_achievement.achievement_id)
            user_list.in_progress_achievements.remove(user_achievement.achievement_id)
        else:
            if not user_list.completed_achievements.filter(pk=user_achievement.achievement_id).exists():
                user_list.in_progress_achievements.add(user_achievement.achievement_id)


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_achievement_slug_userachievement_achievementevent'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.RenameModel(
            old_name='AchievementList',
            new_name='UserAchievementList',
        ),
        migrations.AlterField(
            model_name='userachievementlist',
            name='owner',
            field=models.OneToOneField(on_delete=models.deletion.CASCADE, related_name='user_achievement_list', to=settings.AUTH_USER_MODEL),
        ),
        migrations.RemoveField(
            model_name='userachievementlist',
            name='achievements',
        ),
        migrations.AddField(
            model_name='userachievementlist',
            name='completed_achievements',
            field=models.ManyToManyField(blank=True, related_name='completed_by_users', to='users.achievement'),
        ),
        migrations.AddField(
            model_name='userachievementlist',
            name='in_progress_achievements',
            field=models.ManyToManyField(blank=True, related_name='in_progress_by_users', to='users.achievement'),
        ),
        migrations.RunPython(copy_user_achievement_states, noop_reverse),
        migrations.RemoveField(
            model_name='achievementevent',
            name='user_achievement',
        ),
        migrations.DeleteModel(
            name='UserAchievement',
        ),
    ]
