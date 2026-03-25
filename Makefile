.PHONY: up down logs migrate migration seed test lint format typecheck shell-db reload reload-backend reload-frontend rebuild rebuild-backend rebuild-frontend

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

# restart containers (picks up env/config changes; code changes use HMR)
reload:
	docker compose restart backend frontend

reload-backend:
	docker compose restart backend

reload-frontend:
	docker compose restart frontend

rebuild:
	docker compose up -d --build

rebuild-backend:
	docker compose up -d --build backend

rebuild-frontend:
	docker compose up -d --build frontend
