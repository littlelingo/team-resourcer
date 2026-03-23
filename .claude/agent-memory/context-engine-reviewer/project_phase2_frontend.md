---
name: Phase 2 Frontend Architecture
description: Tech stack, patterns, and architecture of the Phase 2 team-resourcer frontend
type: project
---

React + TypeScript frontend using TanStack Query, react-hook-form + zod, Radix UI primitives, Tailwind CSS, sonner for toasts.

Backend is FastAPI. All routes are nested under `/api/`. Teams are nested under areas: `/api/areas/{area_id}/teams/`.

**Why:** Phase 2 builds the full CRUD UI on top of the Phase 1 backend.

**How to apply:** When reviewing mutations, always verify HTTP method matches backend (PUT vs PATCH), URL shape matches backend router structure, and query invalidation covers all relevant keys.

Key patterns observed:
- Query keys follow `[resource, "list"|"detail"|"members", ...params]` shape
- All hooks export a `{resource}Keys` object for invalidation
- Form dialogs use `useEffect` to `reset()` on open rather than `defaultValues` prop to handle re-open with different data
- `as unknown as` casts in MembersPage indicate a type impedance mismatch between TeamMemberList (list response) and TeamMember (detail response) — the edit flow from the table view passes a list item but the form expects a detail item
- TeamsPage uses a `useAllTeams` inline hook with `useQueries` to fan out per-area fetches since the backend has no flat `/api/teams/` endpoint

Simplification review findings (2026-03-23):
- `getInitials()` is duplicated identically in MemberCard.tsx, memberColumns.tsx, and MemberDetailSheet.tsx — should be extracted to a shared util
- The actions dropdown (DropdownMenu.Root + trigger + Edit/Delete items) is copy-pasted verbatim across programColumns.tsx, functionalAreaColumns.tsx, and teamColumns.tsx — candidate for a shared `RowActionsMenu` component
- ProgramFormDialog.tsx and FunctionalAreaFormDialog.tsx are structurally identical (same schema, same useEffect reset pattern, same form layout with name + description) — strong candidate for a generic `SimpleEntityFormDialog` abstraction
- Three simple pages (ProgramsPage, FunctionalAreasPage, and effectively TeamsPage minus the fan-out) share the same add/edit/delete state + table + two dialogs + confirm pattern — refactoring into a shared `EntityTablePage` render prop or hook is high ROI
- MembersPage has two separate MemberFormDialog instances mounted simultaneously (add + edit) — only one needs to be mounted; conditionally rendering based on mode is simpler
- `ProgramMembersSheet` in ProgramsPage.tsx is an inline component that reimplements the side-sheet pattern already established by MemberDetailSheet — not shared
- DataTable imports both `DataTable` named export and default export — the file exports both to support two different import styles used across pages (inconsistency)
- `useTeams` returns an empty array when no `areaId` is provided instead of being disabled — this is an odd hollow-query pattern that can confuse callers
