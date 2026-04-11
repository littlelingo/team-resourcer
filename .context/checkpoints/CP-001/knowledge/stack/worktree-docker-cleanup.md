# Git Worktree + Docker Compose Cleanup

> Last updated: 2026-04-09
> Components: git worktree, Docker Compose, agent workflows

## What This Solves

When an agent runs in an isolated `git worktree` and spins up a Docker Compose stack inside it, the containers and their named volumes persist after the worktree is removed. This leaks:

- **Ports** (5432 Postgres, 5173 Vite, 8000 FastAPI) — blocking the main project's `make up` with "port is already allocated"
- **File ownership** — bind-mounted directories (`node_modules`, `uploads`) get files written as the container's uid (999 for postgres, 1000 for node). Removing the worktree directory from the host then hits permission-denied on those files.

Hit during feature 057 implementation: the agent's worktree containers remained running after the agent exited, and `docker compose up` in the main project failed to bind port 5432. The orphaned worktree dir also resisted `rm -rf` because `frontend/node_modules` was owned by uid 1000.

## Configuration

No config changes required — this is a **process fix**, not a tooling fix.

The project name Docker Compose uses is derived from the directory name by default. A worktree at `.claude/worktrees/agent-ad1f2d64/` gets compose project `agent-ad1f2d64`, separate from the main project `team-resourcer`.

## Critical Order of Operations

When tearing down a worktree that ran Docker Compose:

1. **Stop and remove the agent's containers FIRST**:
   ```bash
   docker stop agent-<hash>-db-1 agent-<hash>-backend-1 agent-<hash>-frontend-1
   docker rm agent-<hash>-db-1 agent-<hash>-backend-1 agent-<hash>-frontend-1
   ```
   Or by compose project name (cleaner):
   ```bash
   docker compose -p agent-<hash> down -v
   ```
   The `-v` removes named volumes too — safe for agent-scoped workspaces, would be destructive for the main project.

2. **Only then remove the worktree**:
   ```bash
   git worktree remove .claude/worktrees/agent-<hash> --force
   git worktree prune -v
   ```

3. **If the worktree directory still has permission-denied files** (Docker-uid-owned `node_modules` or `uploads`):
   ```bash
   sudo rm -rf .claude/worktrees/agent-<hash>
   ```
   This only happens if step 1 was skipped or the containers held file locks.

## Common Failures

**Symptom**: `make up` fails with "Bind for 0.0.0.0:5432 failed: port is already allocated".
**Cause**: An agent worktree's Postgres container is still running, holding port 5432.
**Fix**: `docker ps --format '{{.Names}}'` to find the offender; `docker stop <name>` then `docker rm <name>`. Then retry `make up`.

**Symptom**: `rm -rf .claude/worktrees/agent-<hash>` fails with "Permission denied" on `frontend/node_modules` or `backend/uploads`.
**Cause**: Docker container bind-mounted those dirs and wrote files as its internal uid (not your user). The dir is yours but the files inside aren't.
**Fix**: `sudo rm -rf` the directory. The agent's git worktree metadata has already been pruned, so there's no git state to preserve.

**Symptom**: `git worktree remove` succeeds but the directory is still present.
**Cause**: Git removes its metadata but leaves the files if permission-denied errors occur during cleanup.
**Fix**: Check `git worktree list` — if the worktree is not listed, git is done with it; just `sudo rm -rf` the leftover directory.

## Rule of thumb

**Always stop the agent's containers before removing the worktree.** The file-ownership trap and port-collision trap both trace back to skipping this step. A helper Makefile target could wrap the sequence, but for now it's a manual discipline.
