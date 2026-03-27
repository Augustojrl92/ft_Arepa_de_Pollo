DOCKER_COMPOSE = docker compose -f docker-compose.dev.yml
MODE ?= full
# ─── Default ───────────────────────────────────────────────────────────────────
all: full-up

# ─── Frontend ──────────────────────────────────────────────────────────────────
front-up:
	$(DOCKER_COMPOSE) up -d --build frontend

front-stop:
	$(DOCKER_COMPOSE) stop frontend

front-down:
	$(DOCKER_COMPOSE) rm -sfv frontend

front-re: front-down front-up

front-logs:
	$(DOCKER_COMPOSE) logs -f frontend

# ─── Backend ───────────────────────────────────────────────────────────────────
back-up:
	$(DOCKER_COMPOSE) up -d --build backend db

back-stop:
	$(DOCKER_COMPOSE) stop backend db

back-down:
	$(DOCKER_COMPOSE) rm -sf backend db

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
	$(DOCKER_COMPOSE) stop

full-down:
	$(DOCKER_COMPOSE) down --remove-orphans

full-re: full-down full-up

full-logs:
	$(DOCKER_COMPOSE) logs -f

# ─── Limpieza total ────────────────────────────────────────────────────────────
fclean:
	$(DOCKER_COMPOSE) down --volumes --rmi all --remove-orphans

# ─── Aliases ───────────────────────────────────────────────────────────────────
up: back-up
stop: back-stop
down: back-down
logs: back-logs
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
