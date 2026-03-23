---
name: phase2_frontend_fixes
description: Phase 2 frontend code-review critical and important fixes applied 2026-03-23
type: project
---

All ten code-review fixes applied in one pass. Key decisions:

- All update mutations changed PATCH -> PUT (backend requirement, all four hooks)
- Programs field array removed from MemberFormDialog entirely (backend uses separate endpoints; collecting it in the form silently dropped the data)
- Table edit now sets `pendingEditUuid` state and waits for `useMember()` to return the full TeamMember before opening the edit dialog — avoids casting TeamMemberList to TeamMember
- Single MemberFormDialog instance in MembersPage (open when addOpen OR editMember is set)
- `view` URL param runtime guard: `rawView === 'table' ? 'table' : 'card'` instead of a cast
- team_id reset on functional_area_id change uses a `isFirstRender` ref to skip the effect on initial mount (avoids clearing pre-populated team when opening edit dialog)
- ImageUpload: ALLOWED_TYPES ['image/jpeg','image/png','image/webp'], MAX_SIZE 5MB, alert on violation, useEffect cleanup revokes object URL, handleRemove also revokes
- `getInitials` extracted to `src/lib/member-utils.ts`; imported in MemberCard, memberColumns, MemberDetailSheet
- Shared `RowActionsMenu` in `src/components/shared/RowActionsMenu.tsx`; used by programColumns, functionalAreaColumns, teamColumns, memberColumns
- ProgramsPage member avatar uses `getImageUrl(member.image_path)` instead of bare image_path

**Why:** Code review identified data-loss bugs (programs silently dropped, incomplete member data on edit), broken HTTP methods, and type-safety holes.

**How to apply:** When touching mutation hooks, always verify HTTP method matches backend API. When editing from list views, always fetch full resource before opening edit forms.
