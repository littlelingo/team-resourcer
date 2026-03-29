---
name: 029-functional-manager review findings
description: Key findings from Feature 029 review (functional manager + direct report rename) on 2026-03-29
type: project
---

Two self-referencing FKs on team_members (supervisor_id + functional_manager_id). All four SQLAlchemy relationships specify foreign_keys= and remote_side= correctly.

**Critical finding — cycle detection bypass via generic update path**: MemberFormDialog.tsx submits functional_manager_id (and supervisor_id) via the generic PUT /members/:uuid endpoint (update_member), which has no cycle-detection logic. The dedicated /org/members/:uuid/functional-manager endpoint has it, but the form never calls it. This directly violates the "Bypassing dedicated endpoints" anti-pattern.

**Critical finding — FK existence not validated**: Neither create_member nor update_member (nor set_supervisor/set_functional_manager) verify that the submitted supervisor_id or functional_manager_id UUIDs exist before committing. An invalid UUID produces an unhandled IntegrityError → 500. The ANTI_PATTERNS doc explicitly covers this.

**Warning — @property lazy load risk on list path**: supervisor_name and functional_manager_name are @property decorators that access the supervisor/functional_manager relationships. list_members now eager-loads both, so this is safe for the current list path. Risk: if any future query path forgets to include these selectinloads, it will trigger a greenlet_spawn/DetachedInstanceError at serialization time, not a clean error.

**Warning — MemberDetailSheet org section condition uses _id not object**: Line 133 gates the "Organization" section on `member.supervisor_id || member.functional_manager_id`, but the rows inside render conditionally on `member.supervisor` and `member.functional_manager` (the resolved objects). If _id is set but the object wasn't loaded, the section header renders with no rows inside it.

**Suggestion — supervisorOptions reused for functional manager**: The Functional Manager select in MemberFormDialog uses the same `supervisorOptions` list (which filters out self). Does not filter out the current supervisor or existing cycle chains — but this is cosmetic/UX, not a correctness bug at the form level.

**What was done well**: cycle detection algorithm is correct (walks functional_manager_id chain, detects both self-assignment and chain cycles), relationship foreign_keys are all correct, Pydantic serialization of nested MemberRefResponse works correctly with from_attributes=True, tests cover the main happy-path and error cases for the new endpoint.
