---
name: Research: Searchable Select / Combobox (feature 049 candidate)
description: 2026-03-30 findings on adding type-ahead/search to SelectField and MultiSelectField dropdowns
type: project
---

Key findings on current SelectField/MultiSelectField and what's needed for search.

**Why:** User wants to type to filter options in dropdowns, especially useful for large lists (supervisors, programs).

**How to apply:** Build a new `ComboboxField` (and `MultiComboboxField`) using `cmdk` which is already installed, replacing SelectField usages where search is desired.

## Current components

- `SelectField` uses `@radix-ui/react-select` (Radix Select primitives) — no search input possible, only native keyboard type-ahead (jump to first match). 70 lines, simple trigger+content+items structure.
- `MultiSelectField` uses `@radix-ui/react-dropdown-menu` with CheckboxItems — no search. 90 lines.
- Both use `cn()` from `@/lib/utils` (clsx + tailwind-merge).

## Usage count

SelectField: 5 JSX usages across 2 files
- `MemberFormDialog.tsx` lines 202, 216, 248, 263 — area, team, direct manager, functional manager dropdowns
- `EntityMembersSheet.tsx` line 66 — "Select member…" picker when adding a member to an entity

MultiSelectField: 1 JSX usage
- `MemberFormDialog.tsx` line 233 — programs multi-select

## Dependencies available

- `cmdk@^1.1.1` — already installed (package.json line 35). This is the standard shadcn/ui Command/Combobox primitive.
- `@radix-ui/react-select@^2.2.6` — installed
- `@radix-ui/react-dropdown-menu@^2.1.16` — installed
- `@radix-ui/react-popover` — NOT installed. cmdk typically pairs with Popover; would need install or use a different container.
- No existing Combobox, Command, or cmdk usage anywhere in src/ (only a test file mentions "command" as a string).

## Architecture for new ComboboxField

Standard pattern: `@radix-ui/react-popover` (Popover trigger + content) wrapping a `cmdk` Command component with CommandInput + CommandList + CommandItems. This is the shadcn Combobox pattern.

Since `@radix-ui/react-popover` is NOT installed, options:
1. Install it (small, peer of other Radix packages already present)
2. Use a `<div>` with manual open state + `onBlur` dismiss — simpler but less accessible
3. Use `@radix-ui/react-dialog` as the container (already installed, overkill)

Option 1 (install popover) is the canonical approach.

## Key design constraints

- Must accept same `{ value, label }[]` options prop shape as current SelectField
- Must fire `onChange(value: string)` for single / `onChange(value: string[])` for multi
- NONE_VALUE sentinel (`__none__`) still needed for single-select clear
- Tailwind + cn() styling, match existing border/ring/rounded-md visual language
- z-index `z-[100]` on dropdown content (matches existing dropdowns inside dialogs)

## Files to create / modify

New files:
- `frontend/src/components/shared/ComboboxField.tsx` — single-select with search
- `frontend/src/components/shared/MultiComboboxField.tsx` — multi-select with search (optional, can add later)

Files to update if replacing existing usages:
- `MemberFormDialog.tsx` — swap SelectField → ComboboxField for area, team, supervisor, functional manager (all potentially large lists)
- `EntityMembersSheet.tsx` — swap SelectField → ComboboxField for "Select member…" (member list can be large)
