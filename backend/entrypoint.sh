#!/bin/bash
set -e

# If a command is passed run it and exit.
if [ "$#" -gt 0 ]; then
	exec "$@"
fi

# Start cron daemon
cron

# Serve HTTP and WebSocket traffic through the ASGI application.
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
