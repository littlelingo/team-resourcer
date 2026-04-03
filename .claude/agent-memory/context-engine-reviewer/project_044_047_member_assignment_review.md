---
name: Features 044-047 Security Review — Member Assignment, MultiSelect, EntityMembersSheet
description: Security and correctness review of member assign/unassign flows, MultiSelectField, EntityMembersSheet, and program sync logic (2026-04-03)
type: project
---

Reviewed features 044-047 on 2026-04-03.

**Key findings:**

1. **Cache invalidation gap in useAssignProgram/useUnassignProgram** — onSuccess only invalidates `programKeys.all` and `memberKeys.all`. The `programKeys.members(id)` key is never invalidated, so the EntityMembersSheet for a program shows stale membership until a page reload. Same applies in useUnassignProgram. Not flagged as a prior issue.

2. **Redundant program_id in assign body** — `useAssignProgram` posts `{ member_uuid, program_id }` in the body AND in the URL path (`/api/programs/${programId}/assignments`). The backend schema `ProgramAssignmentCreate` accepts both and the service uses the path param for the program lookup but the body `program_id` for the assignment row. These are always equal from the hook but a caller could supply mismatched values. Low risk in practice since the hook controls both.

3. **No auth layer** — confirmed: the backend has no authentication middleware. All mutation routes (assign, unassign, add/remove team member) are unauthenticated. This is a known, accepted architectural state for an internal tool (noted in phase2 security review).

4. **XSS: all member data rendered safely** — EntityMembersSheet uses JSX text interpolation throughout (`{member.first_name}`, template literals). No dangerouslySetInnerHTML. No risk.

5. **MultiSelectField: values never leave the server-fetched option set** — toggle() adds/removes from the value array but only using `opt.value` from props. The Zod schema validates `program_ids` as `z.array(z.string()).optional()`. No free-text entry possible; XSS and injection are not applicable here.

6. **program_ids diff logic correctness** — useMemberForm.ts:196-218 correctly diffs currentProgramIds (from member.program_assignments) vs selectedProgramIds (from form values), issuing only needed POST/DELETE calls. Previously these were silently discarded (see feedback_program_assignments_not_submitted). Now resolved.

7. **No error handling on individual assignment calls** — the diff loop in onSubmit awaits each apiFetch sequentially but is inside a single try/catch. If one DELETE succeeds and the next POST fails, the UI shows a generic error but the state is partially mutated. No rollback. Medium-severity UX issue.

8. **useTeamMembers query path** — `/api/members/?team_id=${teamId}` — numeric teamId passed directly to URL. No validation. Pre-existing issue noted in phase2 review (same pattern as program_id/area_id URL params).

**Why:** Features 044-047 implement the member assignment/unassign UI and the program multi-select in MemberFormDialog.
**How to apply:** In future reviews of assignment flows, check cache key invalidation completeness and sequential-mutation error handling.
