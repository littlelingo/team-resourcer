# PRP: Code Quality Adaptation

**Status**: COMPLETE
**Strategy**: implement-then-test

## Findings Applied

### Step 1: Move DB mutation out of upload_image_route into service layer
- `members.py:90-91` directly sets `member.image_path` and calls `db.commit()` in the route
- Add `update_member_image()` to `member_service.py`; route calls service instead

### Step 2: Add program_id FK validation in assign_member
- `program_service.py:78` — `assign_member` doesn't check program exists → IntegrityError → 500
- Add `get_program(db, program_id)` check before insert

### Step 3: Improve import commit error handling
- `import_commit.py:299-305` — session deleted on exception; user can't retry
- Only delete session on successful commit

### Findings Dismissed

- `_get_or_create_program` scoped by name only: Program.name has `unique=True` DB constraint — this is correct. The anti-pattern applies to child entities with parent FKs.
- `add_member_route` returning `{"ok": True}`: LOW severity, deferred.
