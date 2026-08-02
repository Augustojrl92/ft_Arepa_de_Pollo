DOCKER_COMPOSE = docker compose -f docker-compose.dev.yml
MODE ?= full
DOCKER ?= docker
CSV_PATH ?= /app/evaluations_snapshot_round_apr_oct_2026.csv
DRY_RUN ?=
BACKUP_FILE ?=

# ─── TLS certificate subject names ────────────────────────────────────────────
# Detected at run time so a new DHCP lease never requires editing a file. The
# machine name is included because it is stable across leases: prefer
# https://$(HOST_NAME).local over the IP for anything you have to register
# somewhere, such as the 42 OAuth redirect URI.
#
# Override either part when needed:
#   make certs-reset HOST_IP=10.11.12.13
#   make certs-reset TLS_SAN=DNS:localhost,IP:127.0.0.1
HOST_IP ?= $(shell ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $$7; exit}')
HOST_NAME ?= $(shell hostname)

TLS_SAN_BASE = DNS:localhost,DNS:$(HOST_NAME),DNS:$(HOST_NAME).local,IP:127.0.0.1
ifneq ($(strip $(HOST_IP)),)
TLS_SAN ?= $(TLS_SAN_BASE),IP:$(HOST_IP)
else
TLS_SAN ?= $(TLS_SAN_BASE)
endif

# Per-service default flags for `docker compose rm` regarding volumes.
# Set these in the environment if you want different behavior, e.g.
#   make back-down BACK_RM_VOLUMES=-v
FRONT_RM_VOLUMES ?= -v
BACK_RM_VOLUMES ?= -v

# Helper: stop a specific service(s) only if any of them are running
define stop_if_running
@running=""; \
for svc in $(1); do \
  $(DOCKER) ps --filter "label=com.docker.compose.service=$$svc" -q | grep -q . && running="$$running $$svc" || true; \
done; \
if [ -n "$$running" ]; then \
	echo "Stopping:$$running"; \
	$(DOCKER_COMPOSE) stop $$running; \
	echo "Stopped:$$running"; \
else \
	for svc in $(1); do echo "$$svc not running, skipping stop"; done; \
fi
endef

# Helper: stop selected services only if any of the important services are running
# We consider frontend, backend, db, or public_api as the key services for full-stop (OR)
define stop_all_if_running
@# Check frontend/backend/db/public_api and stop only those actually running (simple OR check)
@running=""; \
for svc in frontend backend db public_api; do \
  $(DOCKER) ps --filter "label=com.docker.compose.service=$$svc" -q | grep -q . && running="$$running $$svc" || true; \
done; \
if [ -n "$$running" ]; then \
	echo "Stopping selected services:$$running"; \
	$(DOCKER_COMPOSE) stop $$running; \
	echo "Stopped selected services:$$running"; \
else \
	echo "no selected services running (frontend/backend/db/public_api), skipping stop"; \
fi
endef

# ─── Default ───────────────────────────────────────────────────────────────────
full-up:

# ─── Frontend ──────────────────────────────────────────────────────────────────
front-up:
	$(DOCKER_COMPOSE) up -d --build frontend

front-stop:
	$(call stop_if_running,frontend)

front-down:
	$(DOCKER_COMPOSE) rm -sf $(FRONT_RM_VOLUMES) frontend

front-re: front-down front-up

front-logs:
	$(DOCKER_COMPOSE) logs -f frontend

# ─── Backend ───────────────────────────────────────────────────────────────────
back-up:
	$(DOCKER_COMPOSE) up -d --build backend db

back-stop:
	$(call stop_if_running,backend db)

back-down:
	$(DOCKER_COMPOSE) rm -sf $(BACK_RM_VOLUMES) backend db

back-re: back-down back-up

back-logs:
	$(DOCKER_COMPOSE) logs -f backend db

back-migrate:
	$(DOCKER_COMPOSE) run --rm backend python manage.py migrate

back-makemigrations:
	$(DOCKER_COMPOSE) run --rm backend python manage.py makemigrations

back-makemigrations-app:
	@if [ -z "$(APP)" ]; then echo "Uso: make back-makemigrations-app APP=authentication"; exit 1; fi
	$(DOCKER_COMPOSE) run --rm backend python manage.py makemigrations $(APP)

back-showmigrations:
	$(DOCKER_COMPOSE) run --rm backend python manage.py showmigrations

back-showmigrations-app:
	@if [ -z "$(APP)" ]; then echo "Uso: make back-showmigrations-app APP=authentication"; exit 1; fi
	$(DOCKER_COMPOSE) run --rm backend python manage.py showmigrations $(APP)

back-syncdb: back-makemigrations back-migrate

back-superuser:
	$(DOCKER_COMPOSE) run --rm backend python manage.py createsuperuser

back-shell:
	$(DOCKER_COMPOSE) run --rm backend python manage.py shell

back-test:
	$(DOCKER_COMPOSE) run --rm backend python manage.py test --noinput

back-syncapi:
	$(DOCKER_COMPOSE) exec -T backend python manage.py sync_campus_users --mode=$(MODE)

back-import-evaluations:
	$(DOCKER_COMPOSE) exec -T backend python manage.py import_evaluations_snapshot --path $(CSV_PATH) $(DRY_RUN)

front-pwa:
	./scripts/run_frontend_pwa.sh

db-backup:
	./scripts/backup_db.sh

db-restore:
	@if [ -z "$(BACKUP_FILE)" ]; then echo "Uso: make db-restore BACKUP_FILE=backups/postgres/archivo.sql.gz"; exit 1; fi
	BACKUP_FILE="$(BACKUP_FILE)" ./scripts/restore_db.sh

db-backup-ls:
	@if ls -1 backups/postgres/*.sql.gz >/dev/null 2>&1; then ls -lh backups/postgres/*.sql.gz; else echo "No hay backups en backups/postgres/"; fi

db-backup-auto-up:
	$(DOCKER_COMPOSE) up -d db-backup

db-backup-auto-stop:
	$(DOCKER_COMPOSE) stop db-backup

db-backup-auto-logs:
	$(DOCKER_COMPOSE) logs -f db-backup
# ─── Public API ────────────────────────────────────────────────────────────────
api-up: back-up
	$(DOCKER_COMPOSE) up -d --build public_api

api-stop:
	$(call stop_if_running,public_api)

api-down:
	$(DOCKER_COMPOSE) rm -sf public_api

api-re: api-down api-up

api-logs:
	$(DOCKER_COMPOSE) logs -f public_api

api-alembic-init:
	$(DOCKER_COMPOSE) run --rm public_api alembic init alembic

api-migrate:
	$(DOCKER_COMPOSE) run --rm public_api alembic upgrade head

api-revision:
	@if [ -z "$(MSG)" ]; then echo "Usage: make api-revision MSG=init_public_api_keys"; exit 1; fi
	$(DOCKER_COMPOSE) run --rm public_api alembic revision --autogenerate -m "$(MSG)"

api-history:
	$(DOCKER_COMPOSE) run --rm public_api alembic history

api-current:
	$(DOCKER_COMPOSE) run --rm public_api alembic current

api-downgrade:
	@if [ -z "$(REV)" ]; then echo "Uso: make api-downgrade REV=-1"; exit 1; fi
	$(DOCKER_COMPOSE) run --rm public_api alembic downgrade "$(REV)"

api-syncdb: api-migrate



# ─── Full stack ────────────────────────────────────────────────────────────────
full-up:
	$(DOCKER_COMPOSE) up -d --build

full-stop:
	$(call stop_all_if_running)

full-down:
	$(DOCKER_COMPOSE) down --remove-orphans

full-re: full-down full-up

full-logs:
	$(DOCKER_COMPOSE) logs -f

# ─── TLS ───────────────────────────────────────────────────────────────────────
# The proxy issues a self-signed certificate only when none exists, and keeps it
# in a named volume so it survives rebuilds. Changing TLS_SAN therefore has no
# effect on its own — the old certificate is still there. This throws it away so
# the next start issues a new one for the current TLS_SAN.
#
# The volume is found by its compose label rather than by name, so this keeps
# working whatever the project directory is called.
certs-reset:
	$(DOCKER_COMPOSE) rm -sf proxy
	@vol="$$($(DOCKER) volume ls -q --filter label=com.docker.compose.volume=tls_certs)"; \
	if [ -n "$$vol" ]; then \
		$(DOCKER) volume rm $$vol; \
	else \
		echo "no tls_certs volume found, nothing to remove"; \
	fi
	@echo "Issuing certificate for: $(TLS_SAN)"
	TLS_SAN="$(TLS_SAN)" $(DOCKER_COMPOSE) up -d proxy
	@echo ""
	@echo "Reach the app at https://localhost or https://$(HOST_NAME).local"
	@echo "The .local name survives DHCP changes; the IP does not."
	@echo "Your browser cached an exception for the old certificate, so it will"
	@echo "warn again on the first visit — accept it once more."

# ─── Total wipe ────────────────────────────────────────────────────────────
fclean:
	$(DOCKER_COMPOSE) down --volumes --rmi all --remove-orphans

# ─── Aliases ───────────────────────────────────────────────────────────────────
up: full-up
stop: full-stop
down: full-down
logs: full-logs
migrate: back-migrate
makemigrations: back-makemigrations
initialize: up back-syncdb back-syncapi
reinitialize: fclean initialize
superuser: back-superuser
shell: back-shell
test: back-test

dev-up: front-up
dev-stop: front-stop
dev-down: front-down
dev-logs: front-logs
dev-re: front-re

.PHONY: all \
        front-up front-stop front-down front-re front-logs \
			back-up back-stop back-down back-re back-logs \
			back-migrate back-makemigrations back-makemigrations-app \
			back-showmigrations back-showmigrations-app back-syncdb \
			back-superuser back-shell back-test back-import-evaluations front-pwa \
			db-backup db-restore db-backup-ls \
			db-backup-auto-up db-backup-auto-stop db-backup-auto-logs \
	        full-up full-stop full-down full-re full-logs \
        fclean certs-reset \
		up stop down logs migrate makemigrations initialize reinitialize superuser shell test \
        dev-up dev-stop dev-down dev-re dev-logs
