# Directory Map

```
team-resourcer/
├── .claude/                    # Claude Code config + agent memory
│   ├── settings.json           # MCP servers, plugins, env
│   ├── settings.local.json     # Local overrides (gitignored)
│   └── agent-memory/           # Context engine agent memories
├── .context/                   # Context Engine knowledge base
│   ├── architecture/           # System overview, tech stack, directory map
│   ├── decisions/              # Architecture Decision Records
│   ├── errors/                 # Error index + detail analysis
│   ├── features/               # Feature PRPs and research notes (001-028+)
│   ├── knowledge/              # Learnings, library quirks, stack recipes
│   ├── metrics/                # Framework health metrics
│   ├── patterns/               # Code patterns + anti-patterns
│   └── checkpoints/            # State snapshots for rollback
├── backend/
│   ├── alembic/
│   │   └── versions/           # DB migration scripts
│   ├── app/
│   │   ├── api/routes/         # FastAPI route handlers (7 routers)
│   │   ├── core/               # database.py, config.py
│   │   ├── models/             # SQLAlchemy ORM models (8 tables)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic + import pipeline (16 modules)
│   │   ├── main.py             # App factory, router registration, CORS
│   │   └── seed.py             # Demo data seeder
│   ├── tests/
│   │   ├── conftest.py         # SQLite in-memory fixtures, DELETE-after isolation
│   │   ├── fixtures/           # Shared test data
│   │   ├── integration/        # HTTP-level tests via httpx AsyncClient
│   │   └── unit/               # Service/util unit tests
│   ├── uploads/                # Member image uploads (UUID-named)
│   ├── requirements.txt
│   └── pyproject.toml          # ruff, mypy, pytest config
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── agencies/       # Agency CRUD
│   │   │   ├── functional-areas/ # Area CRUD
│   │   │   ├── import/         # 4-step import wizard
│   │   │   ├── layout/         # AppLayout, PageHeader
│   │   │   ├── members/        # Member cards, detail sheet, form
│   │   │   ├── programs/       # Program CRUD
│   │   │   ├── shared/         # DataTable, ConfirmDialog, Field, etc.
│   │   │   ├── teams/          # Team CRUD
│   │   │   └── trees/          # Org tree (XY Flow canvas + nodes + panels)
│   │   ├── hooks/              # TanStack Query hooks per entity
│   │   ├── lib/                # Utilities (api-client, format-utils, member-utils)
│   │   ├── pages/              # Route-level page components (5 pages)
│   │   ├── test/               # Test setup (jest-dom imports)
│   │   └── types/              # TypeScript type definitions
│   ├── package.json
│   ├── vite.config.ts          # Vitest config embedded
│   └── tailwind.config.js
├── docker-compose.yml          # Dev environment (3 services)
├── docker-compose.prod.yml     # Production overrides
├── Makefile                    # Task runner (30+ targets)
├── CLAUDE.md                   # Project instructions for Claude Code
└── README.md
```
