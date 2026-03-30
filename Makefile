.PHONY: up down logs migrate migration seed test lint format typecheck shell-db reload reload-backend reload-frontend rebuild rebuild-backend rebuild-frontend rebuild-db reset-db up-backend up-frontend up-db

up:
	docker compose down --remove-orphans 2>/dev/null || true
	docker compose up -d
	@docker compose exec backend alembic upgrade head
	@docker compose ps

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
	docker compose stop backend db 2>/dev/null || true
	docker compose rm -f db 2>/dev/null || true
	docker compose up -d --build db
	docker compose start backend 2>/dev/null || true
	@sleep 2
	@docker compose exec backend alembic upgrade head

# drop and recreate the database, then run migrations
reset-db:
	docker compose stop backend
	docker compose exec db psql -U resourcer -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'team_resourcer' AND pid <> pg_backend_pid();"
	docker compose exec db psql -U resourcer -d postgres -c "DROP DATABASE IF EXISTS team_resourcer;"
	docker compose exec db psql -U resourcer -d postgres -c "CREATE DATABASE team_resourcer;"
	docker compose start backend
	@sleep 2
	docker compose exec backend alembic upgrade head
	@echo "Database reset complete."

rebuild:
	docker compose down
	docker compose up -d --build
	@docker compose exec backend alembic upgrade head
	@docker compose ps

rebuild-backend:
	docker compose stop backend 2>/dev/null || true
	docker compose rm -f backend 2>/dev/null || true
	docker compose up -d --build backend

rebuild-frontend:
	docker compose stop frontend 2>/dev/null || true
	docker compose rm -f frontend 2>/dev/null || true
	docker compose up -d --build frontend
