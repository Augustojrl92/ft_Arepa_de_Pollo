import os
import sys

from django.apps import AppConfig
from django.core.management import call_command


class CronSchedulerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'cron_scheduler'

    def ready(self):
        """Register CRONJOBS only when the dev server starts."""
        if len(sys.argv) < 2 or sys.argv[1] != 'runserver':
            return

        # With Django autoreload, only run setup in the reloader child process.
        if os.environ.get('RUN_MAIN') != 'true':
            return

        try:
            try:
                call_command('crontab', 'remove')
            except Exception:
                pass
            call_command('crontab', 'add')
            print('Cron jobs registered.')
        except Exception as exc:
            print(f'Cron setup skipped: {exc}')
