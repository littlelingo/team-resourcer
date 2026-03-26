---
name: 018-member-name-split review
description: Key findings from code review of Feature 018 (member name split + hire_date) on 2026-03-26
type: project
---

Feature 018 splits `name` into `first_name`/`last_name` and adds a nullable `hire_date` field.

**Why:** Reviewed 2026-03-26 at developer's request.

**Key findings:**

CRITICAL:
- `ProgramsPage.tsx:82` — `member.first_name[0]` and `member.last_name[0]` crash when either field is empty string (valid state: single-word names after migration get last_name=""). Should use getInitials() or null-check before indexing.
- `OrgTreeNode` schema (`backend/app/schemas/org.py`) still has `name: str` field and is populated via `member.name` (the @property). Works at runtime but the API response for `/api/org/tree` continues to emit a `name` field — inconsistent with the stated goal that schemas do NOT include a serialized `name` field. Not a crash but a contract inconsistency.
- `useEffect` for form reset in MemberFormDialog does NOT exist — the form only resets its defaultValues on mount. The PRP warned about stale form values when [open, member] changes. However the dialog uses `reset()` on Dialog.Root's onOpenChange and `open` is not tracked with a dedicated reset effect for re-open with a different member. Minor risk but worth flagging.

WARNINGS:
- `import_commit.py:312` — redundant `from datetime import date as _date` import inside the function body; `date` is already imported at the module top (line 6). Dead import shadow.
- `org_service.py:44` — `sorted(roots, key=lambda m: m.name)` uses the @property (first_name + last_name). Works, but sorts by combined full name string rather than by last_name first. Inconsistent with the rest of the codebase which now orders by `last_name, first_name`. Low impact.

SUGGESTIONS:
- PRP Step 12c (backend migration data-split test) was not implemented — no `test_migrations.py` file. Strategy is implement-then-test so this is expected but worth noting for follow-up.

**How to apply:** Watch for `first_name[0]`/`last_name[0]` direct indexing patterns in future reviews — always flag as unsafe when either field can be empty string.
