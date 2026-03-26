.PHONY: up down logs migrate migration seed test lint format typecheck shell-db reload reload-backend reload-frontend rebuild rebuild-backend rebuild-frontend rebuild-db reset-db up-backend up-frontend up-db

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

# start individual services
up-backend:
	docker compose up -d backend

up-frontend:
	docker compose up -d frontend

up-db:
	docker compose up -d db

# rebuild individual services
rebuild-db:
	docker compose up -d --build db

# drop and recreate the database, then run migrations
reset-db:
	docker compose exec db psql -U resourcer -c "DROP DATABASE IF EXISTS team_resourcer;"
	docker compose exec db psql -U resourcer -c "CREATE DATABASE team_resourcer;"
	docker compose restart backend
	@sleep 2
	docker compose exec backend alembic upgrade head
	@echo "Database reset complete."

rebuild:
	docker compose up -d --build

rebuild-backend:
	docker compose up -d --build backend

rebuild-frontend:
	docker compose up -d --build frontend
