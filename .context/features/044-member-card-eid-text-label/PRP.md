# PRP: Add "Employee Id" Text Label to Member Card

## Status: APPROVED

## Context

The member card displays employee IDs with a `Hash` (#) icon, but users can't tell what the value represents. A text label "Employee Id" needs to be added in front of the ID value so the field is self-explanatory.

## Testing Strategy: implement-then-test

## Changes

### 1. `frontend/src/components/members/MemberCard.tsx` (lines 122-128)

- **Add** a `<span className="text-slate-500">Employee Id</span>` text label before the employee ID value
- **Keep** the `Hash` icon as-is

### 2. `frontend/src/components/members/__tests__/MemberCard.test.tsx` (line 100-103)

- **Update** test name to reflect label
- **Add** assertion that "Employee Id" text is present

## Verification

- `cd frontend && npx vitest run src/components/members/__tests__/MemberCard.test.tsx`
