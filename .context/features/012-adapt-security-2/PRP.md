# PRP: Adapt — Security (Round 2)

**Status**: COMPLETE
**Strategy**: implement-then-test
**Branch**: `refactor/adapt-security-2`

## Findings

1. **[MEDIUM]** `import_session.py` — In-memory session dict is process-local; prod compose runs `--workers 2`, so upload on worker A → preview on worker B = 404.
2. **[LOW]** `image_service.py:29-34` — Content-Type header checked redundantly before Pillow magic-byte verification.

## Steps

### Step 1: Fix multi-worker session race in prod compose
Change `--workers 2` to `--workers 1` in `docker-compose.prod.yml`. Async uvicorn handles concurrency within a single process. Add a comment explaining the constraint (in-memory session store requires single worker).

### Step 2: Remove redundant Content-Type check in image_service
Remove the `_ALLOWED_CONTENT_TYPES` check at lines 29-34. The Pillow magic-byte verification at lines 51-54 is the authoritative validation, and the extension is already derived from `Image.open().format`, not the header.
