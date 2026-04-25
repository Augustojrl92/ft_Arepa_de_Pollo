#!/bin/bash
set -e

# If a command is passed run it and exit.
if [ "$#" -gt 0 ]; then
	exec "$@"
fi

# Start cron daemon
cron

# Start Django with Daphne (ASGI) for Channels support
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
