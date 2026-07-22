#!/bin/sh
set -eu
set -o pipefail

BACKUP_DIR="${BACKUP_DIR:-/backups/postgres}"
BACKUP_INTERVAL_SECONDS="${BACKUP_INTERVAL_SECONDS:-21600}"
BACKUP_RETRY_SECONDS="${BACKUP_RETRY_SECONDS:-300}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
POSTGRES_HOST="${POSTGRES_HOST:-db}"

fail() {
	echo "Error: $*" >&2
	exit 1
}

validate_positive_integer() {
	value="$1"
	name="$2"
	case "$value" in
		''|*[!0-9]*) fail "$name must be a positive integer." ;;
	esac
	[ "$value" -gt 0 ] || fail "$name must be greater than zero."
}

validate_positive_integer "$BACKUP_INTERVAL_SECONDS" "BACKUP_INTERVAL_SECONDS"
validate_positive_integer "$BACKUP_RETRY_SECONDS" "BACKUP_RETRY_SECONDS"
validate_positive_integer "$BACKUP_RETENTION_DAYS" "BACKUP_RETENTION_DAYS"

mkdir -p "$BACKUP_DIR"
tmp_file=""

cleanup_tmp() {
	if [ -n "$tmp_file" ]; then
		rm -f "$tmp_file"
	fi
}

trap cleanup_tmp EXIT INT TERM

create_backup() {
	timestamp="$(date -u +"%Y-%m-%d_%H-%M-%S")"
	backup_name="auto_trascendence_${timestamp}.sql.gz"
	tmp_file="$BACKUP_DIR/.${backup_name}.tmp"
	backup_file="$BACKUP_DIR/$backup_name"

	echo "==> Creating automated PostgreSQL backup: $backup_file"
	if ! PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
		--host "$POSTGRES_HOST" \
		--username "$POSTGRES_USER" \
		--dbname "$POSTGRES_DB" \
		--clean \
		--if-exists \
		--create \
		--no-owner \
		--no-privileges \
		| gzip > "$tmp_file"; then
		echo "Error: pg_dump failed; the temporary backup was discarded." >&2
		cleanup_tmp
		return 1
	fi

	if ! gzip -t "$tmp_file"; then
		echo "Error: gzip validation failed; the temporary backup was discarded." >&2
		cleanup_tmp
		return 1
	fi

	mv "$tmp_file" "$backup_file"
	tmp_file=""
	echo "==> Automated backup validated: $backup_file"

	# Retention applies only to automated backups; manual backups are preserved.
	find "$BACKUP_DIR" -type f -name 'auto_trascendence_*.sql.gz' \
		-mtime "+$BACKUP_RETENTION_DAYS" -exec rm -f {} \;
}

echo "==> Automated backups enabled: every ${BACKUP_INTERVAL_SECONDS}s, retention ${BACKUP_RETENTION_DAYS} days."

while true; do
	if create_backup; then
		sleep "$BACKUP_INTERVAL_SECONDS"
	else
		echo "==> Retrying automated backup in ${BACKUP_RETRY_SECONDS}s." >&2
		sleep "$BACKUP_RETRY_SECONDS"
	fi
done
