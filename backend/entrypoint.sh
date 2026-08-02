#!/bin/bash
set -e

# If a command is passed run it and exit.
#
# This is what keeps `docker compose run --rm backend python manage.py ...`
# working, which is how every Makefile target reaches Django. Those must not
# have the start-up sequence below run underneath them.
if [ "$#" -gt 0 ]; then
	exec "$@"
fi

# ── Schema bootstrap ─────────────────────────────────────────────────────────
# On a fresh clone, or after `make fclean` removes the volumes, the database is
# empty: no tables, so every request fails and the app looks hung. Applying
# migrations here makes `docker compose up` sufficient on its own, and closes
# the window where the server answers against a schema that does not exist.
#
# `migrate` is idempotent, so once the schema is current this costs a moment.
# `makemigrations` is deliberately NOT run: generating migrations is an
# authoring step that belongs in a commit, never at boot.

echo "==> Waiting for the database to accept connections..."
attempts=0
until python - <<'PY' 2>/dev/null
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')
django.setup()
from django.db import connection
connection.ensure_connection()
PY
do
	attempts=$((attempts + 1))
	if [ "$attempts" -ge 60 ]; then
		echo "!! Database still unreachable after 60s. Is the db service healthy?" >&2
		exit 1
	fi
	sleep 1
done
echo "==> Database is up"

echo "==> Applying migrations"
if ! python manage.py migrate --noinput; then
	echo "" >&2
	echo "!! migrate failed; refusing to serve against an unknown schema." >&2
	echo "   A frequent cause here is conflicting migrations (multiple leaf" >&2
	echo "   nodes); 'python manage.py makemigrations --merge' resolves that." >&2
	exit 1
fi

# Start cron daemon
cron

# Serve HTTP and WebSocket traffic through the ASGI application.
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
