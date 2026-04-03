---
name: Features 044-047 review (EID label, form prefill, program assignment, entity member management)
description: Key findings from review of features 044-047 on 2026-04-03
type: project
---

Reviewed 2026-04-03. Verdict: CHANGES_REQUESTED. 4 critical, 4 warnings, 4 suggestions.

## Critical bugs found

1. **useAssignProgram / useUnassignProgram missing programKeys.members invalidation** (usePrograms.ts:84,98): Both hooks invalidate `programKeys.all` and `memberKeys.all` but not `programKeys.members(programId)`. ProgramsPage EntityMembersSheet renders from `useProgramMembers(selectedProgram.id)` which uses that specific key. After add/remove, the member list in the sheet does not update until a full refetch. Fix: receive `programId` in `onSuccess` variables and add `qc.invalidateQueries({ queryKey: programKeys.members(programId) })`.

2. **FunctionalAreasPage remove-member silently blocked when no "Unassigned" area exists** (FunctionalAreasPage.tsx:140-141): The guard checks `if (!unassignedArea)` and shows a toast error. The member list count decrements visually but the member is never actually moved. This is a soft data dependency — there is no API to truly unassign from a functional area without assigning to another. Flag as critical UX breakage.

3. **FunctionalAreasPage add-member does not invalidate areaKeys** (FunctionalAreasPage.tsx:129-137): Uses `updateMember.mutate(...)` with a manual `areaMembersQuery.refetch()` in onSuccess. `updateMember` invalidates `memberKeys.all` but does NOT invalidate `areaKeys.all` (which carries `member_count`). The Members column count in the DataTable will be stale after adding/removing.

4. **useMemberForm onSubmit — program sync fires raw apiFetch without cache invalidation** (useMemberForm.ts:203-217): The program add/remove calls at lines 203-217 use `apiFetch` directly, bypassing `useAssignProgram`/`useUnassignProgram` hooks. No TanStack Query cache invalidation happens for `programKeys` or `memberKeys` after these calls. Member detail and program member lists will be stale after saving.

## Warnings found

1. **Duplicate defaultValues block** (useMemberForm.ts:59-79 and 104-124): Form defaults are duplicated between `useForm({ defaultValues })` and the `form.reset(...)` call. If a field is added to the form schema later, it must be added in both places manually — drift will cause fields to not prefill on dialog reopen.

2. **key={i} (array index) for program badge lists** (MemberCard.tsx:106, MemberDetailSheet.tsx:195, MemberDetailPanel.tsx:160): React uses index as key for program_assignments badges. If the array order changes, React will not reconcile correctly.

3. **MemberDetailPanel passes empty string to useMember** (MemberDetailPanel.tsx:16): `useMember(memberId ?? '')` — `enabled: Boolean(uuid)` prevents the fetch, but `["members","detail",""]` is still inserted into the query cache as a registered key. Prefer `useMember(memberId ?? 'SKIP')` with a sentinel or conditional hook call.

4. **MemberDetailSheet employee_id badge always rendered, never guarded** (MemberDetailSheet.tsx:94-97): The EID badge `<span>` at line 94 has no null guard — if `member.employee_id` is null/undefined the badge renders with a Hash icon and empty content. MemberDetailPanel (line 78) has the same issue.

## Suggestions found

1. **MultiSelectField has no aria-label on trigger** (MultiSelectField.tsx:41-52): The trigger has no `aria-label` — screen readers announce only the selected text or placeholder, with no indication this is a multi-select.

2. **EntityMembersSheet: adding a member does not reset ComboboxField on close** (EntityMembersSheet.tsx:40-44): After `handleAdd` fires, `setAdding(false)` closes the control. But if the sheet is closed and reopened, `adding` resets correctly via useState. No bug, but the ComboboxField value is uncontrolled — it always starts empty, which is correct here. (Confirmed no issue.)

3. **MemberDetailPanel: no error state rendered** (MemberDetailPanel.tsx): `useMember` returns `isError` but the component only handles `isLoading` and `member` present. An error leaves the panel content-empty with no feedback.

4. **TeamsPage: useAddTeamMember/useRemoveTeamMember initialized with selectedAreaId=0 before selection** (TeamsPage.tsx:58-59): Same stale-closure fragility pattern as the delete hook (see feedback_stale_closure_delete_team.md). Safe in practice since state update precedes user action.
