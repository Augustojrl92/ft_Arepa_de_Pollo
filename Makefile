DOCKER_COMPOSE = docker compose -f docker-compose.dev.yml
MODE ?= full
DOCKER ?= docker

# Per-service default flags for `docker compose rm` regarding volumes.
# Set these in the environment if you want different behavior, e.g.
#   make back-down BACK_RM_VOLUMES=-v
FRONT_RM_VOLUMES ?= -v
BACK_RM_VOLUMES ?=

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
# We consider frontend, backend or db as the key services for full-stop (OR)
define stop_all_if_running
@# Check frontend/backend/db and stop only those actually running (simple OR check)
@running=""; \
for svc in frontend backend db; do \
  $(DOCKER) ps --filter "label=com.docker.compose.service=$$svc" -q | grep -q . && running="$$running $$svc" || true; \
done; \
if [ -n "$$running" ]; then \
	echo "Stopping selected services:$$running"; \
	$(DOCKER_COMPOSE) stop $$running; \
	echo "Stopped selected services:$$running"; \
else \
	echo "no selected services running (frontend/backend/db), skipping stop"; \
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
	$(DOCKER_COMPOSE) rm -sf$(FRONT_RM_VOLUMES) frontend

front-re: front-down front-up

front-logs:
	$(DOCKER_COMPOSE) logs -f frontend

# ─── Backend ───────────────────────────────────────────────────────────────────
back-up:
	$(DOCKER_COMPOSE) up -d --build backend db

back-stop:
	$(call stop_if_running,backend db)

back-down:
	$(DOCKER_COMPOSE) rm -sf$(BACK_RM_VOLUMES) backend db

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

back-syncapi:
	$(DOCKER_COMPOSE) exec -T backend python manage.py sync_campus_users --mode=$(MODE)

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

# ─── Limpieza total ────────────────────────────────────────────────────────────
fclean:
	$(DOCKER_COMPOSE) down --volumes --rmi all --remove-orphans

# ─── Aliases ───────────────────────────────────────────────────────────────────
up: full-up
stop: full-stop
down: full-down
logs: full-logs
migrate: back-migrate
makemigrations: back-makemigrations
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
		back-superuser back-shell back-test \
        full-up full-stop full-down full-re full-logs \
        fclean \
		up stop down logs migrate makemigrations superuser shell test \
        dev-up dev-stop dev-down dev-re dev-logs
