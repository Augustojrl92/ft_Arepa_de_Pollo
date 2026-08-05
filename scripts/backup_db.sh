#!/usr/bin/env bash
set -euo pipefail

fail() {
	echo "Error: $*" >&2
	exit 1
}

info() {
	echo "==> $*" >&2
}

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.dev.yml"
DB_SERVICE="${DB_SERVICE:-db}"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups/postgres}"

command -v docker >/dev/null 2>&1 || fail "docker no está instalado o no está en PATH."
command -v gzip >/dev/null 2>&1 || fail "gzip no está instalado o no está en PATH."
docker compose version >/dev/null 2>&1 || fail "docker compose no está disponible."
docker info >/dev/null 2>&1 || fail "No se puede acceder al daemon de Docker. Comprueba que Docker está arrancado y que tienes permisos."
[ -f "$COMPOSE_FILE" ] || fail "No se encuentra el archivo de compose: $COMPOSE_FILE"

container_id="$(docker compose -f "$COMPOSE_FILE" ps -q "$DB_SERVICE" 2>/dev/null || true)"
[ -n "$container_id" ] || fail "El servicio '$DB_SERVICE' no está creado. Ejecuta: docker compose -f docker-compose.dev.yml up -d $DB_SERVICE"

container_status="$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)"
[ "$container_status" = "running" ] || fail "El contenedor del servicio '$DB_SERVICE' no está en ejecución. Ejecuta: docker compose -f docker-compose.dev.yml up -d $DB_SERVICE"

mkdir -p "$BACKUP_DIR"

timestamp="$(date +"%Y-%m-%d_%H-%M-%S")"
backup_name="trascendence_${timestamp}.sql.gz"
tmp_file="$BACKUP_DIR/.${backup_name}.tmp"
backup_file="$BACKUP_DIR/$backup_name"

cleanup() {
	rm -f "$tmp_file"
}

trap cleanup EXIT

info "Creando backup PostgreSQL en: $backup_file"

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

gzip -t "$tmp_file" || fail "El backup se generó, pero no pasó la validación gzip."

mv "$tmp_file" "$backup_file"
trap - EXIT

info "Backup validado correctamente."
printf '%s\n' "$backup_file"
