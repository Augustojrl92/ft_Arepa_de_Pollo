DOCKER_COMPOSE_DEV=docker compose -f docker-compose.dev.yml

all: dev-up

dev-up:
	$(DOCKER_COMPOSE_DEV) up -d

dev-stop:
	$(DOCKER_COMPOSE_DEV) stop

dev-down:
	$(DOCKER_COMPOSE_DEV) down

dev-logs:
	$(DOCKER_COMPOSE_DEV) logs -f

dev-re:
	$(DOCKER_COMPOSE_DEV) up -d --build 

.PHONY: all dev-up dev-stop dev-down dev-logs dev-re