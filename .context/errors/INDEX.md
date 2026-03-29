# Error Index

Known error patterns encountered during development. Each entry captures the signature, root cause, and fix so repeat encounters are resolved instantly.

## HTTP/API Errors

| ID | Signature | Root Cause | Fix | Feature |
|----|-----------|-----------|-----|---------|
| ERR-001 | 405 Method Not Allowed on any edit save | Frontend mutations used `method: "PATCH"` while backend routes are `@router.put()` | Change all update mutations to `method: "PUT"` | Phase 2, Phase 3 |
| ERR-002 | 422 Unprocessable Entity on POST /api/areas/{id}/teams/ | `TeamCreate` schema declares `functional_area_id: int` with no default; Pydantic rejects body before route handler can inject it from path | Give field a sentinel default or split it out of the schema | Feature 016 |
| ERR-003 | 422 Unprocessable Entity on member update when clearing nullable field | `model_dump(exclude_none=True)` stripped explicit `None` values meant to clear fields | Change to `model_dump(exclude_unset=True)` | Phase 1 |
| ERR-004 | 404 instead of 200 on /preview or /commit after upload | Import session uploaded to worker A, preview/commit hit worker B (separate memory space) | Change prod compose to `--workers 1`; long-term: shared session store | Feature 012 |
| ERR-005 | 500 on assign_member when program_id does not exist | No FK existence check before INSERT; unhandled `IntegrityError` surfaced as 500 | Add `db.get(Program, program_id)` check; return 404 on miss | Feature 005 |
| ERR-006 | 500 on set FK (supervisor_id / functional_manager_id) with nonexistent UUID | No FK existence check on generic create/update paths; `IntegrityError` not caught | `_validate_member_fks` helper checks existence and raises 404 before write | Feature 029 |
| ERR-007 | 500 on all endpoints when containers are healthy (`asyncpg UndefinedTableError`) | Alembic migrations never run; `make up` does not migrate automatically | Run `make migrate` after fresh start; `make reset-db` already does this | Feature 026 |
| ERR-008 | 400/500 with no CORS headers on preflight | `allow_headers` too narrow (`["Content-Type", "Accept"]`); `VITE_API_URL` env var name mismatch in docker-compose.yml | Widen to `["*"]`; rename env var to `VITE_API_BASE_URL` | Feature 026 |
| ERR-009 | Sub-router returns resource belonging to different parent (no error, wrong data) | `/areas/999/teams/42` succeeded even when team 42 belongs to area 1 — no ownership check | Validate `team.functional_area_id == area_id` on all sub-router operations | Phase 1 |
| ERR-010 | 413 Request Entity Too Large not enforced | `await file.read()` with no size limit; large file OOMs single-worker server | Read at most N+1 bytes; return 413 if exceeded | Phase 4 |

## Data Integrity Errors

| ID | Signature | Root Cause | Fix | Feature |
|----|-----------|-----------|-----|---------|
| ERR-011 | `MissingGreenlet` at runtime on `set_supervisor` response | Eager-load of supervisor relationship missing; lazy-load triggered outside async context | Add explicit `selectinload` for supervisor relationship | Phase 1 |
| ERR-012 | Circular supervisor chain accepted silently | Two-pass import resolved supervisors without cycle detection | Add `_check_no_cycle` walk before committing supervisor assignments | Phase 4 |
| ERR-013 | Circular supervisor/functional-manager chain accepted via generic update | `update_member` / `create_member` bypassed dedicated endpoint's cycle check | `_validate_member_fks` runs cycle detection before both create and update | Feature 029 |
| ERR-014 | Team silently re-parented to different area during import | `get_or_create` scoped only by `name`, not `(name, area_id)` composite key | Scope lookup by full composite key | Phase 4 |
| ERR-015 | Duplicate program assignments after drag-reassign | POST new assignment without DELETE of old one; repeated drags accumulate | DELETE old assignment before POST new | Phase 3 |
| ERR-016 | Org drag-reassign bypasses circular-ref validation | Used generic `PUT /members/{uuid}` instead of `PUT /org/members/{uuid}/supervisor` | Route drag-drop through dedicated supervisor endpoint | Phase 3 |
| ERR-017 | Import row error numbers off by one | Row index was already 1-based from mapper; frontend added `+1` again | Remove redundant increment in frontend row-error display | Phase 4 |
| ERR-018 | Decimal conversion silently swallowed by bare `except:pass` | Bare `except Exception: return` in `_append_history_if_changed` | Narrow to `except (ValueError, InvalidOperation)` | Feature 010 |
| ERR-019 | Decimal/float parse fails for `"$75,000"` / `"1,500.00"` format strings | `Decimal(value)` rejects currency symbols and thousands separators | Normalize via `import_amount_utils.py` before `Decimal()` conversion | Feature 027 |
| ERR-020 | `avatar[0]` crash when `last_name` is empty string | `ProgramsPage` used direct string index on `last_name` for avatar fallback | Use `getInitials()` helper which handles empty strings | Feature 018 |

## Frontend/UX Errors

| ID | Signature | Root Cause | Fix | Feature |
|----|-----------|-----------|-----|---------|
| ERR-021 | Photo selected in form but silently discarded on save | `imageFileRef` populated but `onSubmit` never POSTs to `/api/members/{uuid}/image` | Wire image upload call after create/update in `MemberFormDialog.onSubmit` | Feature 010 |
| ERR-022 | Program assignment fields filled but data discarded on submit | Form rendered program assignment fields whose data the submit handler never sent | Remove unsubmittable fields; use dedicated program assignment UI | Phase 2 |
| ERR-023 | Edit from table overwrites salary/phone with blanks | Passed `TeamMemberList` (sparse projection) to edit form instead of full detail record | Fetch full detail record before opening edit form | Phase 2 |
| ERR-024 | Stale `team_id` when user changes `area` in member form | No reactive watcher; old team_id from previous area sent to API | Add `useEffect` watcher to clear `team_id` when `area_id` changes | Phase 2 |
| ERR-025 | Object URL memory leak on image preview | `URL.createObjectURL()` called without `URL.revokeObjectURL()` cleanup | Add cleanup in effect or on component unmount | Phase 2 |
| ERR-026 | `"A <Select.Item /> must have a value prop"` console error when opening dropdown | `SelectField` "None" item used `value=""`, which Radix Select v2 reserves for placeholder | Replace `value=""` with sentinel `"__none__"` and convert back in `onValueChange` | Feature 016 |
| ERR-027 | Double-mounted dialog causes focus-trap conflict and duplicate queries | Separate `<Dialog>` roots for add vs. edit mode both mounted in DOM | Consolidate to single instance, toggle mode via `member` prop | Phase 2 |
| ERR-028 | `getInitials` duplicated 3x, actions dropdown 4x — divergence risk | Copy-paste rather than extraction to shared component | Extract to `member-utils.ts` / shared component | Phase 2 |
| ERR-029 | Detail sheet section visible (header shown) even when all data absent | Section guard checked raw `_id` fields; rows rendered resolved objects which could be null | Gate section visibility on resolved objects, not raw IDs | Feature 029 |
| ERR-030 | History timeline shows raw decimal string ("120000.00") instead of formatted currency | History `entry.value` rendered directly without formatting | Apply `formatCurrency`/`formatNumber` helpers; extract to `format-utils.ts` | Feature 028 |
| ERR-031 | Auto-suggest column mapping missing `agency_name` for program import | `PROGRAM_TARGET_FIELDS` in `MapColumnsStep.tsx` lacked the `agency_name` field | Add `agency_name` to `PROGRAM_TARGET_FIELDS` | Feature 023 |
| ERR-032 | No query cache invalidation after import commit | `invalidateQueries` not called after successful commit | Add `queryClient.invalidateQueries` for all affected entity keys | Phase 4 |
| ERR-033 | Import session not cleaned up on DB commit failure | Session deleted before `db.commit()` was confirmed | Wrap cleanup in `try/finally` so session is removed regardless of outcome | Phase 4 |
| ERR-034 | Dagre phantom nodes for orphaned edges | `setEdge()` called before both endpoints registered; Dagre auto-creates placeholder nodes | Guard `setEdge` — only call after both source and target nodes are confirmed added | Phase 3 |
| ERR-035 | Dragged node not restored to original position when no drop target found | Drop handler had no fallback; node left floating at release coordinates | Restore node position on drop-outside-target | Phase 3 |
| ERR-036 | `image` vs `image_path` field name mismatch between backend tree service and frontend MemberNode | Backend `tree_service` serialized as `image_path`; frontend read `image` | Align field name across tree service response and `MemberNode` component | Phase 3 |
| ERR-037 | Date format strings rejected during import ("01/15/2024" / "2024-01-15") | `datetime.fromisoformat()` only accepts ISO format; locale-specific formats fail | Auto-detect format via `import_date_utils.py` (try multiple strptime patterns) | Feature 024 |

## Security Errors

| ID | Signature | Root Cause | Fix | Feature |
|----|-----------|-----------|-----|---------|
| ERR-038 | Malicious file type accepted if `Content-Type` header is spoofed | File type validated by `file.content_type` (client-controlled) | Use Pillow `Image.open().verify()` for magic-byte validation; derive extension from Pillow-detected format | Phase 1 / Feature 004 |
| ERR-039 | Credential file path leaked in 422 error response | Exception message from credential load included raw filesystem path | Log full error server-side; return generic client message | Phase 4 |
| ERR-040 | PII (email, employee_id) exposed in tree node payload unnecessarily | Tree service included all model fields in node data | Restrict node data to rendering-only fields; put relational IDs in edges | Phase 3 |
| ERR-041 | `--reload` flag ships in production Docker image | `CMD` in `backend/Dockerfile` included `--reload` without guard | Remove `--reload` from Dockerfile CMD; dev compose overrides with explicit command | Feature 011 |
| ERR-042 | 4 dependency CVEs (python-multipart, pillow, starlette) | Unpinned/outdated transitive dependencies | Upgrade affected packages | Phase 1 |

## Infrastructure Errors

| ID | Signature | Root Cause | Fix | Feature |
|----|-----------|-----------|-----|---------|
| ERR-043 | Frontend Vite HMR not working inside Docker container | No bind mount for frontend source; Vite not in polling mode | Add bind mount + anonymous `node_modules` volume; set `usePolling: true` in `vite.config.ts` | Feature 009 |
| ERR-044 | `make up` / `make rebuild` fail silently with port-bind error (exit 0) | `docker compose up` exits 0 even when port already in use; prior `down` not run | Add `docker compose down --remove-orphans` before `up`; add `down` before rebuild | Feature 025 |
| ERR-045 | Port 5432 conflict when local Postgres is running alongside Docker db service | `docker-compose.yml` maps `5432:5432`; clashes with native Postgres | Document conflict; optionally remap to non-standard host port | Feature 025 |
| ERR-046 | Frontend image `node:20-alpine` unpinned — non-reproducible builds | `frontend/Dockerfile` used `node:20-alpine` without patch version | Pin to `node:20.20.1-alpine3.23` matching backend convention | Feature 011 |
| ERR-047 | `shadowedDatetime` import error — `datetime` imported twice in commit/mapper | `import_commit.py` and `import_mapper.py` had shadowed `datetime` imports after refactor | Remove duplicate import statements | Feature 018 |
| ERR-048 | 4 test failures: `ValueError: Unknown target field(s) in column_map: location` | `valid_members.csv` fixture still has `location` column after city/state split (feature 020) | Replace `location` with `city` + `state` in CSV fixture; regenerate xlsx | Feature 034 |

## Anti-Pattern Cross-Reference

| Anti-Pattern | ERR IDs |
|-------------|---------|
| `exclude_none=True` in updates | ERR-003 |
| Trusting Content-Type for uploads | ERR-038 |
| Missing FK existence checks | ERR-005, ERR-006 |
| Redundant session cleanup | (style only — no runtime error) |
| PATCH vs PUT mismatch | ERR-001 |
| Form collecting unsubmittable data | ERR-022 |
| Passing list-projection to edit form | ERR-023 |
| Multiple dialog instances | ERR-027 |
| Sub-router without ownership validation | ERR-009 |
| Tree node data exposing unnecessary fields | ERR-040 |
| Bypassing dedicated endpoints | ERR-013, ERR-016 |
| Multi-step mutation without cleanup | ERR-015 |
| Unbounded file read | ERR-010 |
| get_or_create scoped only by name | ERR-014 |
