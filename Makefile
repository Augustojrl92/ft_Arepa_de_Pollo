DOCKER_COMPOSE=docker compose -f docker-compose.dev.yml

all: full-up

front-up:
	$(DOCKER_COMPOSE) up -d --build frontend

front-stop:
	$(DOCKER_COMPOSE) stop frontend

front-down:
	$(DOCKER_COMPOSE) stop frontend

front-logs:
	$(DOCKER_COMPOSE) logs -f frontend

front-re:
	$(DOCKER_COMPOSE) up -d --build frontend

back-up:
	$(DOCKER_COMPOSE) up -d --build backend db

back-stop:
	$(DOCKER_COMPOSE) stop backend db

back-down:
	$(DOCKER_COMPOSE) stop backend db

back-logs:
	$(DOCKER_COMPOSE) logs -f backend db

back-migrate:
	$(DOCKER_COMPOSE) run --rm backend python manage.py migrate

back-superuser:
	$(DOCKER_COMPOSE) run --rm backend python manage.py createsuperuser

back-shell:
	$(DOCKER_COMPOSE) run --rm backend python manage.py shell

back-test:
	$(DOCKER_COMPOSE) run --rm backend python manage.py test

full-up:
	$(DOCKER_COMPOSE) up -d --build

full-stop:
	$(DOCKER_COMPOSE) stop

full-down:
	$(DOCKER_COMPOSE) down

full-logs:
	$(DOCKER_COMPOSE) logs -f

full-re:
	$(DOCKER_COMPOSE) up -d --build

up: back-up
stop: back-stop
down: back-down
logs: back-logs
migrate: back-migrate
superuser: back-superuser
shell: back-shell
test: back-test

dev-up: front-up
dev-stop: front-stop
dev-down: front-down
dev-logs: front-logs
dev-re: front-re

.PHONY: all front-up front-stop front-down front-logs front-re back-up back-stop back-down back-logs back-migrate back-superuser back-shell back-test full-up full-stop full-down full-logs full-re up stop down logs migrate superuser shell test dev-up dev-stop dev-down dev-logs dev-re
