# Research: Employee ID Label on Member Views

## Problem (Revised)

Feature 044 added "Employee Id" text to three locations:
1. **MemberCard.tsx** (grid tile) — already had a Hash (#) icon, so now shows both icon + text (redundant)
2. **MemberDetailSheet.tsx** (detail slide-out) — added "Employee Id" text inside badge pill
3. **MemberDetailPanel.tsx** (tree panel) — same badge change

## User Feedback

The MemberCard now shows both the Hash icon AND "Employee Id" text — too much. User wants:
- **MemberCard**: Keep Hash icon only, remove "Employee Id" text span (line 126)
- **Detail views**: Keep "Employee Id" text in badge (these have no hash icon)

## Current MemberCard Employee ID (lines 122-129)

```tsx
{member.employee_id && (
  <div className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400">
    <Hash className="h-3 w-3 flex-shrink-0" />
    <span className="text-slate-500">Employee Id</span>   ← REMOVE THIS LINE
    <span className="truncate">{member.employee_id}</span>
  </div>
)}
```

## Fix

Remove line 126: `<span className="text-slate-500">Employee Id</span>`

Update test assertion back to just checking for the ID value (remove "Employee Id" text assertion).

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/members/MemberCard.tsx` | Remove "Employee Id" text span (line 126) |
| `frontend/src/components/members/__tests__/MemberCard.test.tsx` | Remove "Employee Id" text assertion |
