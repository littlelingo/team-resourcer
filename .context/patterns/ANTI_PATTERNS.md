# Anti-Patterns

## `exclude_none=True` in update services
**Don't**: Use `data.model_dump(exclude_none=True)` in update operations.
**Do**: Use `data.model_dump(exclude_unset=True)`.
**Why**: `exclude_none` prevents clients from explicitly clearing nullable fields (e.g., setting `team_id` to null to unassign from a team).

## Trusting Content-Type header for file uploads
**Don't**: Validate uploaded files solely by `file.content_type` (client-controlled HTTP header).
**Do**: Use Pillow `Image.open().verify()` to validate magic bytes.
**Why**: Clients can upload malicious files (HTML, JS) with spoofed content types.

## Missing FK existence checks before assignment
**Don't**: Blindly set FK values without verifying the referenced entity exists.
**Do**: Check existence with `db.get(Model, id)` before setting FKs.
**Why**: Missing checks produce unhandled IntegrityError → 500 instead of clean 404.

## Redundant session cleanup
**Don't**: Add explicit `session.close()` in `finally` when using `async with` context manager.
**Do**: Let the `async with` handle cleanup automatically.

## PATCH vs PUT mismatch between frontend and backend
**Don't**: Use `method: "PATCH"` in frontend when backend routes are `@router.put()`.
**Do**: Match HTTP methods exactly — check backend route decorators.
**Why**: FastAPI returns 405 Method Not Allowed, silently breaking all edit operations.

## Form collecting data it can't submit
**Don't**: Show form fields for data managed by separate API endpoints (e.g., program assignments in the member form).
**Do**: Only include fields the form's submit handler actually sends. Use separate UI for separately-managed relationships.
**Why**: Users fill in data that gets silently discarded on submit — a data-loss UX bug.

## Passing list-projection type where detail type is needed
**Don't**: Cast `TeamMemberList` to `TeamMember` for edit forms (`as unknown as TeamMember`).
**Do**: Fetch the full detail record before opening the edit form.
**Why**: List projections lack fields like salary/phone — the form shows blanks and can overwrite real data with empty values.

## Mounting multiple dialog instances for add/edit
**Don't**: Render separate Dialog instances for add and edit modes of the same form.
**Do**: Use one instance, toggling mode via the `member` prop (undefined = add, defined = edit).
**Why**: Multiple Dialog roots cause focus-trap conflicts and double-mount internal queries.

## Sub-router without parent ownership validation
**Don't**: Allow `/areas/999/teams/42` to return team 42 even if it belongs to area 1.
**Do**: Validate `team.functional_area_id == area_id` on all sub-router operations.

## Tree node data exposing unnecessary fields
**Don't**: Include relational IDs (supervisor_id, team_id) or PII (email) in tree node data payloads.
**Do**: Include only fields the node component renders. Encode relationships in edges.
**Why**: Widens PII blast radius; relational data already lives in edges.

## Bypassing dedicated endpoints for convenience
**Don't**: Use generic `PUT /members/{uuid}` when a dedicated endpoint exists (e.g., `PUT /org/members/{uuid}/supervisor`).
**Do**: Use the dedicated endpoint — it has domain-specific validation (circular ref checks, etc.).
**Why**: Generic endpoints skip domain validation, allowing invalid state.

## Multi-step mutations without cleanup
**Don't**: POST a new assignment without DELETEing the old one (e.g., program reassignment).
**Do**: DELETE the old relationship first, then POST the new one. Handle partial failure.
**Why**: Creates duplicate assignments; repeated drags accumulate unboundedly.

## Unbounded file read on upload endpoints
**Don't**: `await file.read()` with no size limit.
**Do**: Read at most N+1 bytes and reject if exceeded (HTTP 413).
**Why**: A large upload can OOM a single-worker server.

## get_or_create scoped only by name (missing composite key)
**Don't**: Look up entities by name alone when they belong to a parent (e.g., Team by name without area_id).
**Do**: Scope the lookup by the full composite key (name + parent FK).
**Why**: Silently re-parents existing entities to a different owner, corrupting org structure.
