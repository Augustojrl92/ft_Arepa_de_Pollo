DC=docker compose -f docker-compose.yml

up:
	$(DC) up -d --build
down:
	$(DC) down
logs:
	$(DC) logs -f
migrate:
	$(DC) run --rm web python manage.py migrate
superuser:
	$(DC) run --rm web python manage.py createsuperuser

shell:
	$(DC) run --rm web python manage.py shell

test:
	$(DC) run --rm web python manage.py test
