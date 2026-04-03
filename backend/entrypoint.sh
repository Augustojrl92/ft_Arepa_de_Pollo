#!/bin/bash
set -e

# If a command is passed run it and exit.
if [ "$#" -gt 0 ]; then
	exec "$@"
fi

# Start cron daemon
cron

# Start Django development server
exec python manage.py runserver 0.0.0.0:8000
