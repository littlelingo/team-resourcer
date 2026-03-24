---
name: phase4_import_review_findings
description: Key findings and fragile areas from Phase 4 (Data Import) review on 2026-03-23
type: project
---

Phase 4 import was reviewed on 2026-03-23. All four endpoints work end-to-end.

**Why:** Reviewed for correctness, security, and simplification.
**How to apply:** Use as baseline when reviewing future changes to the import subsystem.

## Critical / Fragile Areas

1. **No file size limit** — `import_router.py` upload endpoint reads entire file into memory with no size check. A large upload can exhaust server RAM. Fix: enforce a max byte count before calling parse_upload.

2. **In-process session store not safe for multi-worker deployments** — `import_session.py` uses a module-level dict. Uvicorn with multiple workers (e.g. `--workers 4`) would produce session-not-found errors across workers. Currently safe with single-worker `--reload` dev config but must be noted for production.

3. **No circular supervisor check** — `import_commit.py` only guards against direct self-reference (`sup_uuid == member_uuid`). A → B → A chains imported in the same batch are not detected. Existing supervisor endpoint has circular-ref protection; import bypass is an inconsistency.

4. **Team name lookup is global, not area-scoped** — `_get_or_create_team` finds a team by name across all areas, then silently re-parents it to a different area if the import says otherwise. This can corrupt existing org structure.

5. **Row index display off-by-one in PreviewStep** — `PreviewRow` renders `row.index + 1` but `row.index` is already 1-based (set in `import_mapper.py` with `enumerate(raw_rows, start=1)`). Rows display as 2, 3, 4… instead of 1, 2, 3…

6. **Google Sheets error detail leaks internal path** — `ImportSheetsError` error messages include `file_path` from env var when credential loading fails, surfacing internal container paths in API 422 responses.

7. **commit_import does not invalidate TanStack Query cache** — After a successful commit, the frontend does not call `queryClient.invalidateQueries` for members/teams/areas. The Members page will show stale data until manual refresh.

## Warnings

- `_get_or_create_functional_area` and `_get_or_create_team` have no uniqueness constraint guard — concurrent imports could race and create duplicate rows.
- `_cleanup_expired_sessions` iterates over `_sessions` with `list(_sessions.items())` which is safe in CPython due to GIL, but the pattern is fragile for PyPy or truly concurrent runtimes.
- `fetchGoogleSheet` in importApi.ts does not set Content-Type header explicitly — it relies on apiFetch to set application/json for non-FormData bodies, which it does correctly. Not a bug but worth confirming.
- `suggestField` in MapColumnsStep.tsx uses a broad `includes` match that could auto-map a column named "Salary Adjustment" to `salary`. Low risk but worth noting.
