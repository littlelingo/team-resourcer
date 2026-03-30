# Research: Edit Member Form Shows Blank Values

## Problem

When a member card/detail is open and the user clicks "Edit", the form dialog opens with blank/placeholder values instead of pre-populated data. The user expects to edit the existing member's values in place.

## Root Cause

**`useMemberForm.ts` (lines 54-76)**: `useForm({ defaultValues })` is called with member data, but React Hook Form only reads `defaultValues` once on mount. The `MemberFormDialog` is always-mounted (shared for both Add and Edit), so re-opening it with a different `member` prop doesn't re-initialize the form.

There is **no `useEffect` that calls `form.reset(memberValues)` when the `member` prop changes or the dialog re-opens in edit mode**.

## Current Flow

### Two edit trigger paths:

1. **Card kebab menu** → `setPendingEditUuid(uuid)` → `useMember(uuid)` fetches full data → `setEditMember(data)` → dialog opens with `member={editMember}`
2. **Detail sheet Edit button** → `setEditMember(member)` → dialog opens with `member={editMember}`

Both paths correctly resolve to a full `TeamMember` object — the data IS available, it just isn't applied to the form.

### Where reset is called today (both wrong):

1. `useMemberForm.ts` line 167 — after successful submit: `form.reset()` (no args = resets to mount-time defaults)
2. `MemberFormDialog.tsx` line 61 — on dialog close: `reset()` (same — mount-time defaults, not clean empty)

## Proposed Fix

Add a `useEffect` in `useMemberForm.ts` that resets the form when the dialog opens:

```ts
useEffect(() => {
  if (open && member) {
    form.reset({
      employee_id: member.employee_id ?? '',
      first_name: member.first_name ?? '',
      // ... all fields mapped from member
    })
  } else if (open && !member) {
    form.reset({ /* clean empty defaults for Add mode */ })
  }
}, [open, member])
```

### Watch out for:

- **`isFirstRender` guard** (lines 93-95): Existing `useEffect` clears `team_id` when `functional_area_id` changes. The `isFirstRender` ref suppresses this on initial load. The new reset effect must coordinate with this guard — reset should happen before `isFirstRender` is set to `false`.
- **`reset()` on close** (MemberFormDialog line 61): Currently resets to mount-time defaults. Should be updated to reset to clean empty defaults explicitly.

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/members/useMemberForm.ts` | Add `useEffect` to reset form when `open`/`member` changes |
| `frontend/src/components/members/MemberFormDialog.tsx` | Possibly update close handler to pass explicit empty defaults |

## Key Files (read-only context)

| File | Role |
|------|------|
| `frontend/src/pages/MembersPage.tsx` | Orchestrates state: `editMember`, `addOpen`, dialog mounting |
| `frontend/src/pages/MembersPage.helpers.tsx` | `MemberDetailSheetWrapper` fetches full member |
| `frontend/src/components/members/MemberDetailSheet.tsx` | Detail view Edit button calls `onEdit(member)` |

## Dependencies

- React Hook Form's `reset()` API
- `useMemberForm` already receives `open` and `member` as parameters

## Risks

- Must preserve `isFirstRender` guard behavior for `team_id` clearing
- Must handle both Add (no member) and Edit (with member) modes cleanly
