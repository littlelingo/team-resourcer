# Research Notes: team-resourcer

**Scanned:** 2026-03-22
**Scanner:** context-engine-researcher

---

## 1. Directory Structure

The repository is currently **empty**. The only content present on disk is:

```
/Users/clint/Workspace/team-resourcer/
└── .claude/
    ├── settings.json
    └── agent-memory/
        └── context-engine-researcher/
```

- No source files, configuration files, or application code exist yet.
- The `.git/` directory confirms a local repo was initialized and a remote (`git@github.com:littlelingo/team-resourcer.git`) was added, but **no commits have been made**.
- The GitHub remote repo is also empty (confirmed via `gh repo view`: no languages, no default branch).

---

## 2. Tech Stack

**Unknown — no source files present.**

The `.claude/settings.json` references one plugin:

```json
{
  "enabledPlugins": {
    "context-engine@context-engine": true
  }
}
```

This suggests the project intends to use the `context-engine` Claude Code plugin, but the application stack itself has not been scaffolded.

---

## 3. Config Files

| File | Present | Notes |
|------|---------|-------|
| `package.json` | No | |
| `pyproject.toml` | No | |
| `Gemfile` | No | |
| `go.mod` | No | |
| `Cargo.toml` | No | |
| `.env` / `.env.example` | No | |
| `Dockerfile` | No | |
| `docker-compose.yml` | No | |
| `.eslintrc` / `eslint.config.*` | No | |
| `tsconfig.json` | No | |
| `biome.json` / `prettier.config.*` | No | |

---

## 4. Test / Lint / Format / Type-check Commands

**None available** — no package manager manifest or toolchain config exists.

---

## 5. API Routes / Endpoint Patterns

**None** — no application code present.

---

## 6. Test File Patterns / Frameworks

**None** — no test infrastructure present.

---

## Summary

This is a **greenfield project**. The repo was initialized on 2026-03-22 and has no application code, dependencies, or tooling configured yet. All findings above should be re-run once the initial codebase is scaffolded.
