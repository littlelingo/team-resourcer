# Research: Searchable Select / Combobox Dropdowns

## Feature Request
Add type-ahead/search to SelectField dropdowns so users can filter/jump to entries in long lists (members, teams, areas, etc.).

## Current State

### SelectField (`frontend/src/components/shared/SelectField.tsx`)
- 70 lines, uses `@radix-ui/react-select` primitives
- Has `NONE_VALUE = "__none__"` sentinel for clearing selections
- Radix Select does NOT support embedded search input — only native OS type-to-jump
- **5 usages**: 4 in MemberFormDialog (area, team, direct manager, functional manager), 1 in EntityMembersSheet (add member picker)

### MultiSelectField (`frontend/src/components/shared/MultiSelectField.tsx`)
- 90 lines, uses `@radix-ui/react-dropdown-menu` with `CheckboxItem`
- No search capability
- Uses `e.preventDefault()` on `onSelect` to keep menu open on toggle
- **1 usage**: programs field in MemberFormDialog

### Dependencies Already Installed
- `cmdk@^1.1.1` — **already in package.json** (never used yet)
- `@radix-ui/react-dialog`, `@radix-ui/react-select`, `@radix-ui/react-dropdown-menu` — all installed
- `@radix-ui/react-popover` — **NOT installed** (needed for the shadcn Combobox pattern)

### No Existing Combobox
- No `cmdk`, Command, or combobox usage exists anywhere in `src/`
- Project uses `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- Both components use `z-[100]` on content layer (they live inside dialogs)

## Recommended Approach

### New Component: `ComboboxField`
Create `frontend/src/components/shared/ComboboxField.tsx`:
- Uses `@radix-ui/react-popover` + `cmdk` (Command) for accessible open/close + search
- Same props as SelectField: `{ value, onChange, placeholder, options, disabled }`
- Preserves `NONE_VALUE` sentinel pattern for clearing
- `CommandInput` for typing, `CommandList` + `CommandItem` for filtered results

### Optional: `MultiComboboxField`
Can defer — programs list is typically small. Only 1 usage.

### Swap Call Sites
- `MemberFormDialog.tsx` lines 202, 216, 248, 263 — replace `SelectField` with `ComboboxField`
- `EntityMembersSheet.tsx` line 66 — replace `SelectField` with `ComboboxField` (needs reset after selection)

### Install
```bash
cd frontend && npm install @radix-ui/react-popover
```

## Key Files

| File | Role |
|------|------|
| `frontend/src/components/shared/SelectField.tsx` | Current non-searchable select |
| `frontend/src/components/shared/MultiSelectField.tsx` | Current non-searchable multi-select |
| `frontend/src/components/members/MemberFormDialog.tsx` | 4 SelectField + 1 MultiSelectField usages |
| `frontend/src/components/shared/EntityMembersSheet.tsx` | 1 SelectField usage (add member picker) |
| `frontend/src/lib/utils.ts` | `cn()` utility |
| `frontend/package.json` | Already has cmdk, needs @radix-ui/react-popover |

## Risks
- EntityMembersSheet uses SelectField differently — fires `handleAdd` immediately on selection, always passes `value=""`. ComboboxField needs to reset display after selection.
- `z-[100]` z-index must be preserved — combobox lives inside dialogs/sheets.
- Must keep props interface identical to SelectField for easy swap.
