---
name: phase5_test_coverage_backend_review
description: Key findings and fragile areas from Phase 5 (Backend Test Coverage) review on 2026-03-24
type: project
---

Backend test suite (108 tests: 25 unit, 83 integration) reviewed on 2026-03-24 on branch feat/002-test-coverage-backend.

**Why:** First test pass for the backend — establishes patterns for future test additions.
**How to apply:** Use as reference when reviewing or adding to the backend test suite.

## Critical / Fragile Areas

1. **conftest.py uses DELETE-after vs rollback isolation** — The `_clean_tables` fixture does table.delete() after each test rather than wrapping each test in a transaction and rolling back. This means a test that COMMITs mid-test (all service functions commit) leaves data in the DB until teardown. If a test panics/fails mid-commit, the autouse teardown still runs because it's `yield`-based, so isolation is actually sound. But it's slower than rollback isolation, and more importantly: the `db_session` fixture and the `client` fixture share the same underlying session. Service functions inside the `client` call `await db.commit()` on that session, which commits data to the in-memory SQLite engine (not to an outer transaction). This is correct behavior for integration tests but means pure rollback isolation is impossible with the chosen architecture. The chosen DELETE approach is the right tradeoff; just worth documenting.

2. **PRP says session fixture should wrap in begin()/rollback() — implementation diverged** — PRP's `db_session` spec used `async with session.begin(): yield session; await session.rollback()`. The actual implementation does NOT use an outer transaction — it just `async with AsyncTestSession() as session: yield session`. This means service-layer commits are real commits, cleaned up by _clean_tables. This is functionally fine but diverges from the PRP and means mid-test failures can leave dirty state until the next test's setup phase.

3. **test_commit_supervisor_cycle_skipped asserts `<= 1`** — The assertion `assert supervisors_set <= 1` passes vacuously if neither supervisor link is set (0 is also <= 1). The test should assert exactly 0 if the cycle detector correctly removes all cyclic links, or assert exactly 1 with a comment explaining which link survives. The loose bound means a regression that sets both would pass undetected.

4. **test_assign_member_program_not_found uses bare except** — The `except Exception: pass` pattern silently eats errors. This will mask test failures if the server unexpectedly returns 201 and then the assert fails, because the exception pathway doesn't reach the assert.

## Warnings

- `setup_function`/`teardown_function` for import tests: Using module-level `setup_function`/`teardown_function` (not fixtures) is correct for synchronous session-state management, but it means if a test is skipped the teardown still does not run (pytest skips teardown for skipped tests using this mechanism). Low risk currently.
- No test for `update_member` clearing a nullable field to None (verifying `exclude_unset` not `exclude_none` behavior from CODE_PATTERNS).
- No test for area-ownership enforcement on team update/delete (the route validates `team.functional_area_id == area_id` but only the GET path has a test for the wrong-area case).
- `test_upload_oversized_file_returns_413` tests the file-size limit that was a known gap from Phase 4 review — good coverage addition.

## Confirmed Fixes (previously known issues now tested)

- `test_commit_get_or_create_team_scoped_by_area` directly tests the composite-key scope (Phase 4 critical issue #4 is now covered).
- `test_commit_supervisor_cycle_skipped` covers the circular supervisor import bypass (Phase 4 critical issue #3, partially — only the batch-detect path; interactive endpoint cycle check was pre-existing).
