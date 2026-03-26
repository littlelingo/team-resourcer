# Bug: Select.Item Empty String Value Error on Members Page

## Current State

Opening the "Add Member" dialog on the Members page throws a console error:

> Uncaught Error: A `<Select.Item />` must have a value prop that is not an empty string.

This fires on every open of the `MemberFormDialog` because `SelectField` renders a "None" clear option with `value=""` — which Radix UI v2 explicitly rejects.

The error also surfaces in `TeamFormDialog` (used on the Teams page) if a member select dropdown opens before members data loads, though the pattern is distinct there (see Root Cause Analysis).

## Root Cause Analysis

### Primary cause: `SelectField` "None" item uses `value=""`

**File:** `/Users/clint/Workspace/team-resourcer/frontend/src/components/shared/SelectField.tsx`, line 42–50

```tsx
<SelectPrimitive.Item
  value=""   // ← INVALID in Radix Select v2
  ...
>
  <SelectPrimitive.ItemText>None</SelectPrimitive.ItemText>
</SelectPrimitive.Item>
```

`@radix-ui/react-select` v2.2.6 (the version in use) reserves the empty string as a sentinel for "no value selected / show placeholder." Any `Select.Item` with `value=""` throws:

> "A `<Select.Item />` must have a value prop that is not an empty string. This is because the Select value can be set to an empty string to clear the selection and show the placeholder."

Source confirmed in: `frontend/node_modules/@radix-ui/react-select/dist/index.js`.

`SelectField` is used in three places inside `MemberFormDialog`:
- Functional Area select (line 317) — options from `useFunctionalAreas()`
- Team select (line 331) — options from `useTeams(areaIdNum)`
- Supervisor select (line 348) — options from `useMembers()`

All three render via `SelectField`, which always includes the offending `value=""` "None" item.

### Secondary issue: `useTeams` `enabled` flag edge case

**File:** `/Users/clint/Workspace/team-resourcer/frontend/src/hooks/useTeams.ts`, line 22–24

```typescript
enabled: areaId !== undefined ? Boolean(areaId) : true,
```

When `MembersPage` calls `useTeams()` (no argument, line 78 of `MembersPage.tsx`) to populate the filter bar, `enabled` resolves to `true` but `queryFn` returns `Promise.resolve([])`. This is benign for the filter bar (it uses a native `<select>`), but if this hook were ever wired to a Radix Select it would display nothing during the loading window and then populate — not a crash risk in the current flow.

### Why it fires on "add member" click (not page load)

`MemberFormDialog` is always mounted in the DOM (line 248 of `MembersPage.tsx`), but `SelectPrimitive.Content` is rendered inside a `SelectPrimitive.Portal` and only materialises when the trigger is interacted with. Radix validates `Select.Item` values at mount time for the portal content — so the error fires the first time the dropdown is opened, not on dialog open.

## Files Involved

| File | Role | Key Lines |
|------|------|-----------|
| `frontend/src/components/shared/SelectField.tsx` | **Bug location** — "None" item uses `value=""` | 42–50 |
| `frontend/src/components/members/MemberFormDialog.tsx` | Consumes `SelectField` 3x; constructs `supervisorOptions`, `areaOptions`, `teamOptions` | 191–196, 317, 331, 348 |
| `frontend/src/pages/MembersPage.tsx` | Renders `MemberFormDialog`; "Add Member" button at line 163 | 163, 248–261 |
| `frontend/src/components/teams/TeamFormDialog.tsx` | Has its own inline Radix `Select.Item` for team lead; uses `value="__none__"` (correct) and populates from `membersQuery.data?.map(m => value={m.uuid})` — safe because uuid is always a non-empty string | 254–271 |
| `frontend/src/hooks/useTeams.ts` | `enabled` logic edge case when called with no arg | 22–24 |
| `frontend/src/hooks/useMembers.ts` | Returns `TeamMemberList[]` — `uuid` is always `string`, never null | — |

## Dependencies

- `@radix-ui/react-select`: `^2.2.6` — the v2 constraint on non-empty `Select.Item` values is the direct cause.
- `react-hook-form` + `Controller` — used to wire `SelectField` into the form; not a contributor to the bug.
- `useMembers`, `useFunctionalAreas`, `useTeams` hooks — provide option data; all return typed arrays with non-null IDs/UUIDs, so **no undefined value propagation** from data fetching.

## Fix

Replace `value=""` on the "None" `Select.Item` in `SelectField` with a sentinel constant (e.g., `"__none__"`) and convert it back to an empty string / `null` in the `onValueChange` handler:

```tsx
// SelectField.tsx
const NONE_VALUE = '__none__'

<SelectPrimitive.Root
  value={value || NONE_VALUE}
  onValueChange={(v) => onChange(v === NONE_VALUE ? '' : v)}
  ...
>
  ...
  <SelectPrimitive.Item value={NONE_VALUE} ...>
    <SelectPrimitive.ItemText>None</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
```

`TeamFormDialog` already follows this exact pattern (`value="__none__"` on its "None" item, line 255) — the fix is to align `SelectField` with it.

## Risks

- **Low risk.** The fix is confined to `SelectField.tsx` (one file, ~5 lines). All callers pass `value` as a string; converting the sentinel back to `""` preserves all existing form behaviour.
- `MemberFormDialog` passes `field.value ?? ''` into `SelectField.value` — after the fix, `SelectField` converts that `''` to `NONE_VALUE` internally, so `Select.Root` receives a valid non-empty string. No caller changes required.
- The fix does not affect form submission logic: `functional_area_id` and `team_id` are already guarded with `parseInt(...) || undefined` in `onSubmit`.

## Open Questions

1. **Are there other uses of `SelectField` outside `MemberFormDialog`?** Current grep shows it is only used in `MemberFormDialog.tsx`. If new pages are added, the fix in `SelectField` will cover them automatically.
2. **Should the "None" label be configurable?** Currently hardcoded. A `clearLabel` prop could be added as a follow-up.
3. **Does `useTeams` called without `areaId` in `MembersPage` need cleanup?** It fires a live query with `enabled: true` but always returns `[]`. Since the filter bar uses a native `<select>`, this is harmless but wasteful — could be guarded with `enabled: false` when `areaId` is undefined.
