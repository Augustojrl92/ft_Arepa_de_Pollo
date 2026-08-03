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
UNAME_S := $(shell uname -s 2>/dev/null)

# `ip route get` is Linux-only (iproute2). Windows uses PowerShell to inspect
# the active route, while macOS uses the BSD-native route/ipconfig equivalent.
ifeq ($(OS),Windows_NT)
HOST_IP ?= $(shell C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/detect_lan_ip.ps1 2>/dev/null | tr -d '\r')
HOST_NAME ?= $(COMPUTERNAME)
else
ifeq ($(UNAME_S),Darwin)
HOST_IP ?= $(shell route get 1.1.1.1 2>/dev/null | awk '/interface: /{print $$2}' | xargs -I {} ipconfig getifaddr {} 2>/dev/null)
else
# Host port for HTTPS. Evaluation machines cannot bind privileged ports, so
# the proxy is published high; nginx still terminates TLS on 443 internally.
HTTPS_PORT ?= 8443

HOST_IP ?= $(shell ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $$7; exit}')
endif
HOST_NAME ?= $(shell hostname)
endif

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

# Helper: stop every service the compose file defines, not a hardcoded list.
# The list used to be written out by hand and drifted three times — once when
# public_api was added, again with redis, again with proxy — each time leaving
# services running after a "stop everything". Asking compose cannot go stale.
define stop_all_if_running
@svcs="$$($(DOCKER_COMPOSE) config --services 2>/dev/null | tr '\n' ' ')"; \
running=""; \
for svc in $$svcs; do \
  $(DOCKER) ps --filter "label=com.docker.compose.service=$$svc" -q | grep -q . && running="$$running $$svc" || true; \
done; \
if [ -n "$$running" ]; then \
	echo "Stopping:$$running"; \
	$(DOCKER_COMPOSE) stop $$running; \
	echo "Stopped:$$running"; \
else \
	echo "nothing running out of:$$svcs"; \
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
	$(DOCKER_COMPOSE) up -d --build backend db redis

back-stop:
	$(call stop_if_running,backend db redis)

back-down:
	$(DOCKER_COMPOSE) rm -sf $(BACK_RM_VOLUMES) backend db redis

back-re: back-down back-up

back-logs:
	$(DOCKER_COMPOSE) logs -f backend db redis

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

api-create-key:
	@if [ -z "$(NAME)" ]; then echo "Usage: make api-create-key NAME=bootstrap_key [EXPIRES_AT=2026-12-31T23:59:59+00:00] [RPM=60]"; exit 1; fi
	$(DOCKER_COMPOSE) run --rm -e NAME="$(NAME)" -e EXPIRES_AT="$(EXPIRES_AT)" -e RPM="$(RPM)" public_api python -m app.cli.create_api_key

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
# TLS_SAN is passed here as well as in certs-reset: otherwise a rebuild after
# the certificate volume was removed would silently mint a localhost-only
# certificate from the .env default.
full-up:
	TLS_SAN="$(TLS_SAN)" $(DOCKER_COMPOSE) up -d --build

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
	@echo "Reach the app at https://localhost:$(HTTPS_PORT) or https://$(HOST_NAME).local:$(HTTPS_PORT)"
	@echo "The .local name survives DHCP changes; the IP does not."
	@echo "Your browser cached an exception for the old certificate, so it will"
	@echo "warn again on the first visit — accept it once more."

# ─── Evaluation ────────────────────────────────────────────────────────────────
# Repoints the stack from localhost to an address other machines can reach, then
# reissues the certificate and restarts what needs restarting.
#
#   make evaluation                      # uses the detected LAN IP
#   make evaluation EVAL_HOST=$(HOST_NAME).local   # stable across DHCP leases
#   make evaluation EVAL_HOST=localhost  # put everything back
#
# The previous .env is kept as .env.bak. Rewriting is idempotent: it replaces
# whatever host is currently configured, so running it twice is harmless.
EVAL_HOST ?= $(HOST_IP)

evaluation:
	@if [ -z "$(strip $(EVAL_HOST))" ]; then \
		echo "Could not detect a LAN address. Pass one explicitly:"; \
		echo "  make evaluation EVAL_HOST=10.11.12.13"; \
		exit 1; \
	fi
	@if [ ! -f .env ]; then echo "No .env found. Copy .env.example first."; exit 1; fi
	@cp .env .env.bak
	@set_env_url() { \
		key="$$1"; value="$$2"; \
		if grep -qE "^$${key}=" .env; then \
			sed -i.sedtmp -E "s#^$${key}=.*#$${key}=$${value}#" .env; \
			rm -f .env.sedtmp; \
		else \
			printf '%s=%s\n' "$$key" "$$value" >> .env; \
		fi; \
	}; \
	set_env_url FRONTEND_URL "https://$(EVAL_HOST)"; \
	set_env_url FT_REDIRECT_URI "https://$(EVAL_HOST)/api/auth/42/callback/"; \
	set_env_url CORS_ALLOWED_ORIGINS "https://$(EVAL_HOST)"; \
	set_env_url CSRF_TRUSTED_ORIGINS "https://$(EVAL_HOST)"
	@hosts="localhost,127.0.0.1,$(HOST_NAME),$(HOST_NAME).local"; \
	case ",$$hosts," in \
		*",$(EVAL_HOST),"*) ;; \
		*) hosts="$$hosts,$(EVAL_HOST)" ;; \
	esac; \
	if grep -qE '^ALLOWED_HOSTS=' .env; then \
		sed -i.sedtmp -E "s#^ALLOWED_HOSTS=.*#ALLOWED_HOSTS=$$hosts#" .env; \
		rm -f .env.sedtmp; \
	else \
		printf 'ALLOWED_HOSTS=%s\n' "$$hosts" >> .env; \
	fi
	@echo "Repointed .env at https://$(EVAL_HOST) (previous copy saved as .env.bak):"
	@grep -E '^(ALLOWED_HOSTS|FRONTEND_URL|FT_REDIRECT_URI|CORS_ALLOWED_ORIGINS|CSRF_TRUSTED_ORIGINS)=' .env | sed 's/^/    /'
	@case "$(EVAL_HOST)" in \
		[0-9]*.[0-9]*.[0-9]*.[0-9]*) eval_san="$(TLS_SAN_BASE),IP:$(EVAL_HOST)" ;; \
		*) eval_san="$(TLS_SAN_BASE),DNS:$(EVAL_HOST)" ;; \
	esac; \
	"$(MAKE)" certs-reset TLS_SAN="$$eval_san"
	$(DOCKER_COMPOSE) up -d --force-recreate backend frontend
	@echo ""
	@echo "──────────────────────────────────────────────────────────────────────"
	@echo "  Open:  https://$(EVAL_HOST):$(HTTPS_PORT)"
	@echo ""
	@echo "  42 OAuth will only work if this exact redirect URI is registered"
	@echo "  on the intra application:"
	@echo "      https://$(EVAL_HOST):$(HTTPS_PORT)/api/auth/42/callback/"
	@echo "  An IP changes with the DHCP lease; $(HOST_NAME).local does not, so"
	@echo "  prefer registering that one:"
	@echo "      make evaluation EVAL_HOST=$(HOST_NAME).local"
	@echo ""
	@echo "  Revert with:  make evaluation EVAL_HOST=localhost"
	@echo "──────────────────────────────────────────────────────────────────────"

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
        fclean certs-reset evaluation \
		up stop down logs migrate makemigrations initialize reinitialize superuser shell test \
        dev-up dev-stop dev-down dev-re dev-logs
