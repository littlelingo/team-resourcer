---
name: project-044-047-cleanup-review
description: Dead code, duplication, and consolidation findings for features 044-047 (EntityMembersSheet, MultiSelectField, entity pages, hooks)
type: project
---

Reviewed EntityMembersSheet, MultiSelectField, usePrograms, useTeams, useFunctionalAreas, useMemberForm, MemberFormDialog, ProgramsPage, FunctionalAreasPage, TeamsPage.

**Key structural finding:** Old ProgramMembersSheet and TeamMembersSheet are fully gone — no dead code from those. Clean migration.

**useAllTeams naming collision:** TeamsPage.tsx (line 21) defines a *local* `useAllTeams` that fans out one query per area ID (uses teamKeys.list). The hook file exports a *different* `useAllTeams` (line 31 of useTeams.ts) that hits the flat /api/teams/ endpoint (teamKeys.listAll). Different shapes, different endpoints, same name. The local one in TeamsPage exists because the flat endpoint may have been added after the page was built. This is a fragile area — anyone refactoring TeamsPage imports might accidentally swap them.

**Why:** The local TeamsPage useAllTeams was written before /api/teams/ existed; the exported one uses that newer endpoint. They are not interchangeable because the flat endpoint returns TeamListItem (no members), while the per-area fanout returns full Team objects.

**How to apply:** When touching TeamsPage imports or the useTeams hook, check which useAllTeams is being used and verify the return shape is compatible. Do not import the exported useAllTeams into TeamsPage as a drop-in replacement without checking the Team vs TeamListItem type difference.

**Import dialog duplication:** The identical Dialog.Root + ImportWizard block appears in ProgramsPage, FunctionalAreasPage, TeamsPage, AgenciesPage, and MembersPage — 5 files. A shared ImportDialog component would cut this significantly.

**useMemberForm defaultValues duplication:** The defaultValues object in form.reset() (line 104-124) is a verbatim copy of the defaultValues in useForm() (line 59-79). If a new field is added, both locations must be updated.

**FunctionalAreasPage "Unassigned" area assumption:** The remove-member flow (line 140-150 of FunctionalAreasPage) depends on finding an area named exactly "Unassigned". This is an implicit naming convention, not enforced by the data model.
