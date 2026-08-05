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
# - Resolve the repository paths and compose files used for the temporary PWA frontend flow.
# Expects:
# - The repo to keep the existing `docker-compose.dev.yml` layout.
# Returns:
# - Shell variables pointing to the repo root and compose file.
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.dev.yml"
PWA_COMPOSE_FILE="$REPO_ROOT/docker-compose.pwa.yml"

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
[ -f "$PWA_COMPOSE_FILE" ] || fail "No se encuentra el archivo de compose PWA: $PWA_COMPOSE_FILE"

# Objective:
# - Restore the normal frontend and proxy services when the PWA session finishes.
# Expects:
# - The compose project to contain the standard `frontend` service.
# Returns:
# - Best-effort restart of the normal dev frontend container.
restore_frontend() {
	info "Restaurando el frontend normal tras la prueba PWA..."
	docker compose -f "$COMPOSE_FILE" up -d --force-recreate frontend proxy >/dev/null 2>&1 || true
}

trap restore_frontend EXIT

info "Arrancando la PWA a traves del proxy HTTPS..."
info "Abre https://localhost:8443/status y comprueba el service worker."
info "Cuando salgas con Ctrl+C, se restaurara el frontend normal."

# Objective:
# - Run the normal frontend service in production mode so nginx continues to
#   expose it at the application's HTTPS entry point.
# Expects:
# - The bind-mounted `/app` source tree to be available inside the container.
# - Backend and db already running if the UI needs live data.
# Returns:
# - A foreground HTTPS session suitable for installability and offline tests.
docker compose -f "$COMPOSE_FILE" -f "$PWA_COMPOSE_FILE" up --build --force-recreate frontend proxy
