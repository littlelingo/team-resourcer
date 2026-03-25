# PRP: Adapt — Code Quality (Round 2)

**Status**: COMPLETE
**Strategy**: implement-then-test
**Branch**: `refactor/adapt-quality`

## Findings

1. **[HIGH]** `MemberFormDialog.tsx` — Image file captured in `imageFileRef` but never submitted after create/update. Silent data loss.
2. **[MEDIUM]** `import_commit.py:97` — Bare `except Exception` in `_append_history_if_changed` swallows unexpected errors.
3. **[LOW]** `import_supervisor.py:29` — `dict[str, Any]` should be `dict[str, uuid.UUID]`.

## Steps

### Step 1: Wire image upload in MemberFormDialog onSubmit
After successful create/update, if `imageFileRef.current` is set, POST the file to `/api/members/{uuid}/image` via `apiFetch` with `FormData`. The `apiFetch` helper already handles `FormData` bodies (skips JSON Content-Type).

### Step 2: Narrow bare except in _append_history_if_changed
Replace `except Exception:` with `except (ValueError, InvalidOperation):` importing `InvalidOperation` from `decimal`.

### Step 3: Tighten type hint in import_supervisor.py
Change `employee_id_to_uuid: dict[str, Any]` to `dict[str, uuid.UUID]` and add `import uuid`.

### Validation
- `make test` passes
- Manual: open member form, pick a photo, save — photo should appear after reload
