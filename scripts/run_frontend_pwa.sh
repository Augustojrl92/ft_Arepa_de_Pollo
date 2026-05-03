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
# - Resolve the repository paths and compose file used for the temporary PWA frontend flow.
# Expects:
# - The repo to keep the existing `docker-compose.dev.yml` layout.
# Returns:
# - Shell variables pointing to the repo root and compose file.
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.dev.yml"
PROJECT_NAME="$(basename "$REPO_ROOT")"

# Objective:
# - Validate local prerequisites before replacing the normal frontend container.
# Expects:
# - Docker, Docker Compose, the Docker daemon, and the compose file to be available.
# Returns:
# - Continues only when the temporary PWA frontend can be started safely.
command -v docker >/dev/null 2>&1 || fail "docker no está instalado o no está en PATH."
docker compose version >/dev/null 2>&1 || fail "docker compose no está disponible."
docker info >/dev/null 2>&1 || fail "No se puede acceder al daemon de Docker. Comprueba que Docker está arrancado y que tienes permisos."
[ -f "$COMPOSE_FILE" ] || fail "No se encuentra el archivo de compose: $COMPOSE_FILE"

# Objective:
# - Remove stale temporary frontend containers left by previous PWA test attempts.
# Expects:
# - Temporary containers created by `docker compose run` to follow the standard
#   `${project}-frontend-run-*` naming pattern.
# Returns:
# - Deletes any matching temporary frontend containers if they exist.
cleanup_temporary_frontend_runs() {
	temporary_container_ids="$(
		docker ps -aq --filter "name=${PROJECT_NAME}-frontend-run-" 2>/dev/null || true
	)"
	if [ -n "$temporary_container_ids" ]; then
		docker rm -f $temporary_container_ids >/dev/null 2>&1 || true
	fi
}

# Objective:
# - Restore the normal frontend service when the temporary PWA session finishes.
# Expects:
# - The compose project to contain the standard `frontend` service.
# Returns:
# - Best-effort restart of the normal dev frontend container.
restore_frontend() {
	info "Restaurando el frontend normal..."
	cleanup_temporary_frontend_runs
	docker compose -f "$COMPOSE_FILE" rm -sf frontend >/dev/null 2>&1 || true
	docker compose -f "$COMPOSE_FILE" up -d frontend >/dev/null 2>&1 || true
}

trap restore_frontend EXIT

cleanup_temporary_frontend_runs
info "Deteniendo el frontend normal para liberar el puerto 3000..."
docker compose -f "$COMPOSE_FILE" rm -sf frontend >/dev/null 2>&1 || true

info "Arrancando frontend temporal en modo PWA..."
info "Este proceso ejecuta 'npm run build' y despues 'npm run start'."
info "Cuando salgas con Ctrl+C, se volvera a levantar el frontend normal."

# Objective:
# - Run a temporary production-like frontend so the service worker can register.
# Expects:
# - The bind-mounted `/app` source tree to be available inside the container.
# - Backend and db already running if the UI needs live data.
# Returns:
# - A foreground frontend session on port 3000 suitable for installability and offline tests.
docker compose -f "$COMPOSE_FILE" run --rm --service-ports frontend sh -lc '
	cd /app &&
	NEXT_PUBLIC_ENABLE_PWA=true npm run build &&
	NEXT_PUBLIC_ENABLE_PWA=true npm run start
'
