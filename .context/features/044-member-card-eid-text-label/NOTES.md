# Research: Add Text Label for Employee ID on Member Detail Views

## Problem

The member detail views display the employee ID as a bare badge pill with no label. Users see a number like "182" but can't tell what it represents. An "Employee Id" label needs to be added in front of the value.

## Correction

Initial research (and implementation) targeted `MemberCard.tsx` (the grid tile), which already had a `Hash` icon. The user was actually looking at the **detail sheet/panel** views where the employee ID appears as an unlabeled badge pill.

## Current State

Two components render the identical unlabeled badge:

### MemberDetailSheet.tsx (lines 94-96) — slide-out on Members page
```tsx
<span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
  {member.employee_id}
</span>
```

### MemberDetailPanel.tsx (lines 78-80) — inline panel on tree views
```tsx
<span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
  {member.employee_id}
</span>
```

Both are the third child of the avatar-adjacent text column (below name h2 and optional title p). Neither has a guard on `employee_id` being present.

## Proposed Fix

Add "Employee Id" text before the badge value in both components:

```tsx
<span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
  Employee Id {member.employee_id}
</span>
```

Or as a separate label span before the badge, depending on preferred visual style.

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/members/MemberDetailSheet.tsx` | Add "Employee Id" label to badge |
| `frontend/src/components/trees/panels/MemberDetailPanel.tsx` | Add "Employee Id" label to badge |
| Tests for both components | Assert "Employee Id" text is present |

## Dependencies

- None. Pure frontend UI change.

## Risks

- None. Both components use the identical markup so the change is symmetric.
