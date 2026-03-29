# Research: Employee ID Label on Member Card

## Problem

The member card does not display the employee ID at all. Users have no way to see a member's employee ID without opening the detail sheet.

## Current State

- **MemberCard** (`frontend/src/components/members/MemberCard.tsx`): Does not render `employee_id`. Shows name, title, area badge, program badges, location (with `MapPin` icon), and functional manager (with `FM:` text prefix).
- **MemberDetailSheet** (line 94-96): Shows `employee_id` as a plain badge pill (`bg-slate-100`) in the header, no icon or label.
- `Hash` icon is imported in the detail sheet but used for `slack_handle`, not employee_id.

## Proposed Fix

Add an employee ID row to MemberCard using the `Hash` icon + value pattern (matching location's `MapPin` + value):

1. Import `Hash` from lucide-react (add to existing import on line 3)
2. Add a new row after location, guarded by `member.employee_id`:
   ```jsx
   {member.employee_id && (
     <div className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400">
       <Hash className="h-3 w-3 flex-shrink-0" />
       <span className="truncate">{member.employee_id}</span>
     </div>
   )}
   ```

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/members/MemberCard.tsx` | Add `Hash` import, add employee_id row |

## Test Notes

- Test fixture already has `employee_id: 'E001'` — no fixture changes needed
- Add test asserting `E001` renders on the card
- No existing tests break (none assert employee_id is absent)
