.PHONY: up down logs migrate migration seed test lint format typecheck shell-db

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose exec backend alembic upgrade head

migration:
	docker compose exec backend alembic revision --autogenerate -m "$(name)"

seed:
	docker compose exec backend python -m app.seed

test:
	docker compose exec backend pytest

lint:
	docker compose exec backend ruff check app/

format:
	docker compose exec backend ruff format app/

typecheck:
	docker compose exec backend mypy app/

shell-db:
	docker compose exec db psql -U resourcer -d team_resourcer
