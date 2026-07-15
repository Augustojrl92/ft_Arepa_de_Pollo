#!/usr/bin/env bash
set -euo pipefail

# Objective:
# - Abort script execution with a clear error message.
# Expects:
# - One or more words describing the failure.
# Returns:
# - Exits the script with status code 1.
fail() {
	echo "Error: $*" >&2
	exit 1
}

# Objective:
# - Print an informational progress message to stderr.
# Expects:
# - One or more words describing the current step.
# Returns:
# - Writes the formatted message to stderr.
info() {
	echo "==> $*" >&2
}

# Objective:
# - Resolve the repo paths and runtime defaults used by the backup flow.
# Expects:
# - Optional environment overrides such as `DB_SERVICE` or `BACKUP_DIR`.
# Returns:
# - Shell variables pointing to the script directory, repo root, compose file,
#   database service name, and destination backup directory.
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.dev.yml"
DB_SERVICE="${DB_SERVICE:-db}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups/postgres}"

# Objective:
# - Validate that the local machine can execute the backup safely.
# Expects:
# - Docker, Docker Compose, gzip, the Docker daemon, and the compose file to be available.
# Returns:
# - Continues only when every required dependency is present.
command -v docker >/dev/null 2>&1 || fail "docker no está instalado o no está en PATH."
command -v gzip >/dev/null 2>&1 || fail "gzip no está instalado o no está en PATH."
docker compose version >/dev/null 2>&1 || fail "docker compose no está disponible."
docker info >/dev/null 2>&1 || fail "No se puede acceder al daemon de Docker. Comprueba que Docker está arrancado y que tienes permisos."
[ -f "$COMPOSE_FILE" ] || fail "No se encuentra el archivo de compose: $COMPOSE_FILE"

# Objective:
# - Ensure the target PostgreSQL container exists and is running before dumping data.
# Expects:
# - The compose project to already have an active `db` service or the service name
#   provided through `DB_SERVICE`.
# Returns:
# - A valid running container id or a clear failure message.
container_id="$(docker compose -f "$COMPOSE_FILE" ps -q "$DB_SERVICE" 2>/dev/null || true)"
[ -n "$container_id" ] || fail "El servicio '$DB_SERVICE' no está creado. Ejecuta: docker compose -f docker-compose.dev.yml up -d $DB_SERVICE"

container_status="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
[ "$container_status" = "running" ] || fail "El contenedor del servicio '$DB_SERVICE' no está en ejecución. Ejecuta: docker compose -f docker-compose.dev.yml up -d $DB_SERVICE"

# Objective:
# - Build a timestamped backup file name and prepare a temporary file.
# Expects:
# - A writable destination directory.
# Returns:
# - Absolute paths for the final `.sql.gz` backup and its temporary staging file.
mkdir -p "$BACKUP_DIR"

timestamp="$(date +"%Y-%m-%d_%H-%M-%S")"
backup_name="trascendence_${timestamp}.sql.gz"
tmp_file="$BACKUP_DIR/.${backup_name}.tmp"
backup_file="$BACKUP_DIR/$backup_name"

# Objective:
# - Remove the temporary artifact if the script exits before the backup is finalized.
# Expects:
# - The temporary backup path to be already defined.
# Returns:
# - Deletes the temporary file when present.
cleanup() {
	rm -f "$tmp_file"
}

trap cleanup EXIT

info "Creando backup PostgreSQL en: $backup_file"

# Objective:
# - Stream a PostgreSQL dump from the running `db` container and compress it on the host.
# Expects:
# - Valid `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` inside the container.
# - `pg_dump` available in the container image.
# Returns:
# - A temporary `.sql.gz` file containing the full logical backup of the database.
docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" sh -lc '
	export PGPASSWORD="$POSTGRES_PASSWORD"
	exec pg_dump \
		--username "$POSTGRES_USER" \
		--dbname "$POSTGRES_DB" \
		--clean \
		--if-exists \
		--create \
		--no-owner \
		--no-privileges
' | gzip > "$tmp_file"

# Objective:
# - Validate that the compressed backup is readable before publishing it as final output.
# Expects:
# - The temporary gzip file to have been created successfully.
# Returns:
# - Moves the temporary file to its final name only if gzip validation passes.
gzip -t "$tmp_file" || fail "El backup se generó, pero no pasó la validación gzip."

mv "$tmp_file" "$backup_file"
trap - EXIT

info "Backup validado correctamente."
printf '%s\n' "$backup_file"
