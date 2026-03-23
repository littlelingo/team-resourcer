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

## Sub-router without parent ownership validation
**Don't**: Allow `/areas/999/teams/42` to return team 42 even if it belongs to area 1.
**Do**: Validate `team.functional_area_id == area_id` on all sub-router operations.
