---
name: project_012_security2_review
description: 012-adapt-security-2 (--workers 1, remove Content-Type check): key findings from review on 2026-03-25
type: project
---

Reviewed on 2026-03-25 on branch refactor/adapt-security-2 (uncommitted — no git diff output; files read directly).

**Why:** Fix in-memory session worker-isolation bug in prod compose; remove redundant Content-Type header check in image_service.
**How to apply:** If future work touches uvicorn workers or image validation, check findings below.

## Confirmed Correct

1. **`--workers 1` is sound** — import_session.py uses a module-level dict (`_sessions: dict[str, ImportSession] = {}`). With multiple workers each process gets its own copy; upload on worker A / preview on worker B is a real 404 path. Single worker with async uvicorn is the correct fix given the in-memory store constraint.

2. **Removing `_ALLOWED_CONTENT_TYPES` check is net-positive for security** — Content-Type is a client-controlled header; the removed check was enforcing untrusted data. Pillow's magic-byte verification (`img.verify()`) is authoritative and sufficient. Extension is derived from `Image.open().format`, not the header.

3. **Double Image.open call is pre-existing** — `image_service.py` calls `Image.open()` twice (once for `verify()`, once to read `.format`). Not introduced by this PR; flagged as a warning.

## Findings (as reviewed)

### Warning

1. **`image_service.py:45` — bare `SyntaxError` catch is broad** — `except (UnidentifiedImageError, SyntaxError)` catches any SyntaxError raised anywhere in the `try` block, not just Pillow's. Could mask unrelated bugs. Should be `PIL.Image.DecompressionBombError` or at minimum a comment justifying SyntaxError.

2. **`image_service.py:43-44 / 49` — double `Image.open(io.BytesIO(data))`** — First open for `verify()`, second open to read `.format`. The second open could use `img.format` from the first `Image.open` but `verify()` closes/invalidates the image object. Pre-existing; not introduced by this PR.

3. **No tests for image validation path** — `test_members_routes.py:127-132` only tests the 404 (member not found) path for image upload. No tests cover: valid image accepted, oversized file rejected, non-image bytes rejected, unsupported format rejected. Strategy is implement-then-test; these are missing but not blocking.

### Suggestion

1. **`docker-compose.prod.yml` comment could reference the session module** — Current comment says "import_session uses in-memory dict". Good. Could add a note about what a proper fix would look like (Redis-backed session) for whoever tackles that next.
