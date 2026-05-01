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
# - Print a high-visibility warning message to stderr.
# Expects:
# - One or more words describing the risk or destructive action.
# Returns:
# - Writes the formatted warning to stderr.
warn() {
	echo "ATENCION: $*" >&2
}

# Objective:
# - Resolve runtime paths, service names, and the backup input requested by the caller.
# Expects:
# - An explicit `BACKUP_FILE` environment variable or the first CLI argument.
# Returns:
# - Shell variables pointing to the repo root, compose file, target db service,
#   and requested backup path.
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.dev.yml"
DB_SERVICE="${DB_SERVICE:-db}"
backup_input="${BACKUP_FILE:-${1:-}}"

# Objective:
# - Validate restore prerequisites before touching the database.
# Expects:
# - An explicit backup file reference plus Docker, Docker Compose, gzip, the Docker daemon,
#   and the compose file to be available.
# Returns:
# - Continues only when the restore can be executed safely.
[ -n "$backup_input" ] || fail "Debes indicar BACKUP_FILE=backups/postgres/archivo.sql.gz"
command -v docker >/dev/null 2>&1 || fail "docker no está instalado o no está en PATH."
command -v gzip >/dev/null 2>&1 || fail "gzip no está instalado o no está en PATH."
docker compose version >/dev/null 2>&1 || fail "docker compose no está disponible."
docker info >/dev/null 2>&1 || fail "No se puede acceder al daemon de Docker. Comprueba que Docker está arrancado y que tienes permisos."
[ -f "$COMPOSE_FILE" ] || fail "No se encuentra el archivo de compose: $COMPOSE_FILE"

# Objective:
# - Normalize the requested backup path to an absolute path inside or outside the repo.
# Expects:
# - Either an absolute file path or a repo-relative path such as `backups/postgres/foo.sql.gz`.
# Returns:
# - An absolute path stored in `backup_file`.
if [[ "$backup_input" = /* ]]; then
	backup_file="$backup_input"
else
	backup_file="$REPO_ROOT/$backup_input"
fi

# Objective:
# - Validate that the selected backup artifact exists, is readable, and is a valid gzip file.
# Expects:
# - The `backup_file` path to be already resolved.
# Returns:
# - Continues only when the backup artifact is usable for restore.
[ -f "$backup_file" ] || fail "No existe el archivo de backup: $backup_input"
[ -r "$backup_file" ] || fail "No se puede leer el archivo de backup: $backup_input"
gzip -t "$backup_file" || fail "El archivo no es un gzip válido: $backup_input"

# Objective:
# - Ensure the target PostgreSQL container exists and is running before restoring data.
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
# - Detect whether the backend is currently running so the restore can avoid active app connections.
# Expects:
# - The compose project may or may not have a `backend` container started.
# Returns:
# - A `backend_was_running` flag used by the shutdown and restart steps.
backend_was_running=0
backend_container_id="$(docker compose -f "$COMPOSE_FILE" ps -q backend 2>/dev/null || true)"
if [ -n "$backend_container_id" ]; then
	backend_status="$(docker inspect -f '{{.State.Status}}' "$backend_container_id" 2>/dev/null || true)"
	if [ "$backend_status" = "running" ]; then
		backend_was_running=1
	fi
fi

# Objective:
# - Restart the backend automatically after the restore if this script had to stop it.
# Expects:
# - The `backend_was_running` flag to reflect the pre-restore state.
# Returns:
# - Best-effort restart of the backend service on script exit.
restore_backend() {
	if [ "$backend_was_running" -eq 1 ]; then
		info "Arrancando de nuevo el servicio backend..."
		docker compose -f "$COMPOSE_FILE" start backend >/dev/null 2>&1 || true
	fi
}

trap restore_backend EXIT

warn "El restore de PostgreSQL es destructivo."
warn "Se restaurará la base de datos usando el backup: $backup_file"

if [ "$backend_was_running" -eq 1 ]; then
	info "Deteniendo temporalmente el backend para evitar conexiones activas..."
	docker compose -f "$COMPOSE_FILE" stop backend >/dev/null
fi

info "Restaurando backup..."

# Objective:
# - Decompress the selected backup and replay it against PostgreSQL inside the `db` container.
# Expects:
# - The backup file to contain SQL generated by the companion backup script.
# - Valid `POSTGRES_USER` and `POSTGRES_PASSWORD` inside the container.
# Returns:
# - Recreates the database state contained in the dump, failing immediately on SQL errors.
gzip -dc "$backup_file" | docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" sh -lc '
	export PGPASSWORD="$POSTGRES_PASSWORD"
	exec psql \
		--username "$POSTGRES_USER" \
		--dbname postgres \
		--set ON_ERROR_STOP=1
'

info "Restore completado correctamente."
