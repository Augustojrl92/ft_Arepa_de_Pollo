#!/usr/bin/env bash
set -euo pipefail

fail() {
	echo "Error: $*" >&2
	exit 1
}

info() {
	echo "==> $*" >&2
}

warn() {
	echo "ATENCION: $*" >&2
}

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.dev.yml"
DB_SERVICE="${DB_SERVICE:-db}"
backup_input="${BACKUP_FILE:-${1:-}}"

[ -n "$backup_input" ] || fail "Debes indicar BACKUP_FILE=backups/postgres/archivo.sql.gz"
command -v docker >/dev/null 2>&1 || fail "docker no está instalado o no está en PATH."
command -v gzip >/dev/null 2>&1 || fail "gzip no está instalado o no está en PATH."
docker compose version >/dev/null 2>&1 || fail "docker compose no está disponible."
docker info >/dev/null 2>&1 || fail "No se puede acceder al daemon de Docker. Comprueba que Docker está arrancado y que tienes permisos."
[ -f "$COMPOSE_FILE" ] || fail "No se encuentra el archivo de compose: $COMPOSE_FILE"

if [[ "$backup_input" = /* ]]; then
	backup_file="$backup_input"
else
	backup_file="$REPO_ROOT/$backup_input"
fi

[ -f "$backup_file" ] || fail "No existe el archivo de backup: $backup_input"
[ -r "$backup_file" ] || fail "No se puede leer el archivo de backup: $backup_input"
gzip -t "$backup_file" || fail "El archivo no es un gzip válido: $backup_input"

container_id="$(docker compose -f "$COMPOSE_FILE" ps -q "$DB_SERVICE" 2>/dev/null || true)"
[ -n "$container_id" ] || fail "El servicio '$DB_SERVICE' no está creado. Ejecuta: docker compose -f docker-compose.dev.yml up -d $DB_SERVICE"

container_status="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
[ "$container_status" = "running" ] || fail "El contenedor del servicio '$DB_SERVICE' no está en ejecución. Ejecuta: docker compose -f docker-compose.dev.yml up -d $DB_SERVICE"

backend_was_running=0
backend_container_id="$(docker compose -f "$COMPOSE_FILE" ps -q backend 2>/dev/null || true)"
if [ -n "$backend_container_id" ]; then
	backend_status="$(docker inspect -f '{{.State.Status}}' "$backend_container_id" 2>/dev/null || true)"
	if [ "$backend_status" = "running" ]; then
		backend_was_running=1
	fi
fi

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

gzip -dc "$backup_file" | docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" sh -lc '
	export PGPASSWORD="$POSTGRES_PASSWORD"
	exec psql \
		--username "$POSTGRES_USER" \
		--dbname postgres \
		--set ON_ERROR_STOP=1
'

info "Restore completado y validado correctamente."
