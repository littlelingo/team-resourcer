# Research: Add Text Label for Employee ID on Member Card

## Problem

The member card displays the employee ID with only a `Hash` (#) icon prefix. Users cannot tell what that value represents without prior context. A text label like "EID:" is needed in front of the value.

## Current State

- **MemberCard.tsx** (lines 122-128): Employee ID row uses `Hash` icon + raw value, no text label.
- **Functional Manager row** (lines 130-136): Uses `FM:` text prefix pattern — this is the UI precedent for labeled card rows.
- **Feature 036** added the employee ID row originally but only with an icon, not a text label.

## Current Employee ID Rendering (line 122-128)

```tsx
{member.employee_id && (
  <div className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400">
    <Hash className="h-3 w-3 flex-shrink-0" />
    <span className="truncate">{member.employee_id}</span>
  </div>
)}
```

## Proposed Fix

Replace the `Hash` icon with a text label prefix matching the FM pattern:

```tsx
{member.employee_id && (
  <div className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400">
    <span className="text-slate-500">EID:</span>
    <span className="truncate">{member.employee_id}</span>
  </div>
)}
```

- Remove `Hash` icon, add `EID:` text span with `text-slate-500` (matches FM row)
- If `Hash` import is no longer used elsewhere, remove it from the import line

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/members/MemberCard.tsx` | Replace Hash icon with "EID:" text label |
| `frontend/src/components/members/__tests__/MemberCard.test.tsx` | Update test to assert label text |

## Dependencies

- None. Pure frontend UI change.

## Risks

- None. The Hash icon may still be used in the import line by other parts — verify before removing.
