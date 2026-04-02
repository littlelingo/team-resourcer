# PRP: Searchable Select Dropdowns

## Status: COMPLETE
## Testing Strategy: implement-then-test

## Context
Select dropdowns had no search/filter capability. Users had to scroll through all options to find entries. Added ComboboxField component using cmdk (already installed) + @radix-ui/react-popover for type-ahead search in all form dropdowns.

## Changes Made

### 1. Installed `@radix-ui/react-popover`
For accessible popover open/close behavior.

### 2. Created `ComboboxField` component
**File:** `frontend/src/components/shared/ComboboxField.tsx`
- Popover + cmdk Command with automatic fuzzy filtering
- Same props as SelectField — drop-in replacement
- Includes "None" option to clear selection
- Search input auto-focuses on open

### 3. Swapped SelectField → ComboboxField in MemberFormDialog
**File:** `frontend/src/components/members/MemberFormDialog.tsx`
- 4 dropdowns: Functional Area, Team, Direct Manager, Functional Manager

### 4. Swapped SelectField → ComboboxField in EntityMembersSheet
**File:** `frontend/src/components/shared/EntityMembersSheet.tsx`
- Member picker for adding members to teams/areas/programs

## Verification
- 135 frontend tests pass
- SelectField still available for non-searchable use cases (e.g., SearchFilterBar)
