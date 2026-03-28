---
name: 026-cors-fix review
description: 026-cors-fix (allow_headers wildcard, VITE_API_BASE_URL rename): key findings from review on 2026-03-28
type: project
---

Both changes are correct and safe for a dev environment.

Key facts to remember:
- FastAPI CORSMiddleware reflects requested headers rather than echoing `*` when `allow_credentials=True` — this is correct RFC behaviour, not a bug.
- `allow_headers=["*"]` with `allow_credentials=True` is safe in FastAPI; the PRP explicitly flags it as a dev-environment choice with a note to tighten in a production hardening pass.
- The VITE_API_BASE_URL rename was a 3-way alignment fix: docker-compose.yml, frontend/.env.development, and vite.config.ts all already used `VITE_API_BASE_URL`; only compose had the stale `VITE_API_URL` key.
- One warning: the docker-compose.yml env injection only benefits fully containerized runs. The Vite dev server inside the container reads `.env.development` at build time (not runtime env), so the compose env var is only effective if Vite picks it up via the Docker build arg / env injection path — worth confirming if this ever goes to a non-local environment.

**Why:** recorded to track the credential+wildcard header nuance and the compose env-injection edge case.
**How to apply:** when reviewing future CORS or env var changes, check whether compose env vars are truly runtime-injected or only present at build time.
