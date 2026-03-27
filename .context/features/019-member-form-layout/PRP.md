---
feature: 019-member-form-layout
status: VALIDATED
complexity: LOW
testing_strategy: implement-then-test
created: 2026-03-27
depends_on: 018-member-name-split
---

# PRP: Member Form Layout Adjustment

## Problem Statement

After feature 018 added `first_name`, `last_name`, and `hire_date` fields, the form layout in `MemberFormDialog` was implemented with:
- Employee ID + First Name in one row
- Last Name alone on a full-width row
- Hire Date alone on a full-width row

The desired layout groups name fields together and pairs Hire Date with Employee ID so the form reads more naturally and uses vertical space efficiently.

## Solution Overview

A purely cosmetic JSX restructure of the "Basic info" section in `MemberFormDialog.tsx`. No schema, logic, submit handler, or backend changes are required. The grid pattern `grid grid-cols-2 gap-3` already exists in the file and is used for Email + Phone, Slack + Location, and Functional Area + Team rows — applying it here is consistent with existing practice.

**Target layout (lines 262–293 of current file):**

| Row | Fields | Grid |
|-----|--------|------|
| 1 | Photo | full width |
| 2 | First Name + Last Name | `grid grid-cols-2 gap-3` |
| 3 | Hire Date + Employee ID | `grid grid-cols-2 gap-3` |
| 4 | Title | full width |
| 5 | Email + Phone | `grid grid-cols-2 gap-3` (unchanged) |

---

## Implementation Steps

### Step 1 — Restructure the Basic Info Section in MemberFormDialog

**File to modify:** `frontend/src/components/members/MemberFormDialog.tsx`

The current "Basic info" block spans lines 262–293 and contains four separate JSX elements:
1. A `div.grid.grid-cols-2.gap-3` containing Employee ID + First Name (lines 262–277)
2. A standalone `<Field label="Last Name" ...>` (lines 279–285)
3. A standalone `<Field label="Hire Date" ...>` (lines 287–292)
4. A standalone `<Field label="Title" ...>` (line 295–297)

Replace the current four elements with three elements:

**Element 1 — First Name + Last Name row (new 2-col grid):**
```tsx
<div className="grid grid-cols-2 gap-3">
  <Field label="First Name" required error={errors.first_name?.message}>
    <input
      {...register('first_name')}
      className={inputCls}
      placeholder="First name"
    />
  </Field>
  <Field label="Last Name" required error={errors.last_name?.message}>
    <input
      {...register('last_name')}
      className={inputCls}
      placeholder="Last name"
    />
  </Field>
</div>
```

**Element 2 — Hire Date + Employee ID row (new 2-col grid):**
```tsx
<div className="grid grid-cols-2 gap-3">
  <Field label="Hire Date" error={errors.hire_date?.message}>
    <input
      {...register('hire_date')}
      type="date"
      className={inputCls}
    />
  </Field>
  <Field label="Employee ID" required error={errors.employee_id?.message}>
    <input
      {...register('employee_id')}
      className={inputCls}
      placeholder="EMP-001"
    />
  </Field>
</div>
```

**Element 3 — Title (unchanged, full width):**
```tsx
<Field label="Title" error={errors.title?.message}>
  <input {...register('title')} className={inputCls} placeholder="Job title" />
</Field>
```

The comment `{/* Basic info */}` on line 261 can be preserved as-is above the first new grid div.

All subsequent fields (Email + Phone, Slack + Location, Organization, Supervisor, Compensation) are untouched.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# Must exit 0 — no type changes are involved, so any error indicates a JSX syntax mistake
```

---

### Step 2 — Visual Verification

With the dev server running (`make dev` or `docker compose up`), open the Members page in a browser.

**Add Member dialog (`/members` → "Add Member" button):**
- Row 1: Photo upload (full width)
- Row 2: "First Name" input on the left, "Last Name" input on the right — both equal width
- Row 3: "Hire Date" date picker on the left, "Employee ID" input on the right — both equal width
- Row 4: "Title" input (full width)
- Row 5: "Email" + "Phone" (unchanged, side by side)
- Remaining rows unchanged

**Edit Member dialog (click any member's Edit action):**
- Same layout as above
- All fields pre-populate correctly — layout change does not affect data binding since `register()` calls and field names are unchanged

---

## File Manifest

| File | Action |
|---|---|
| `frontend/src/components/members/MemberFormDialog.tsx` | MODIFY — restructure lines 262–293 only |

---

## Validation Criteria

```bash
# 1. TypeScript clean
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# Expected: exit 0, no errors

# 2. Dev server starts without console errors
# Start: make dev (or docker compose up)
# Open browser to http://localhost:5173/members
# Open DevTools console — must be clean

# 3. Add Member dialog layout
# Click "Add Member"
# Verify:
#   - "First Name" and "Last Name" appear side-by-side on the same row
#   - "Hire Date" and "Employee ID" appear side-by-side on the row below
#   - "Title" is full-width on the row below that
#   - "Employee ID" required asterisk and error state still function (fill all except employee_id, submit — error appears on the right column of the second row)

# 4. Edit Member dialog layout
# Click edit on any existing member
# Verify:
#   - Same layout as Add Member
#   - first_name, last_name, hire_date, employee_id all pre-populate in their new positions

# 5. Submit still works
# Fill in all required fields in Add Member form
# Submit — member appears in list with correct name
```

---

## Testing Plan

**Strategy:** implement-then-test (project default per CLAUDE.md).

No new automated tests are required for this change. It is a layout-only JSX restructure — no logic, computed values, event handlers, or data transformations are modified. The existing TypeScript compiler check (`npx tsc --noEmit`) is the automated gate. Visual verification in the browser is the acceptance test.

If a snapshot or component-level rendering test suite exists for `MemberFormDialog` at the time of implementation, update any snapshot that captures field order. Check for existing test files:
```bash
find /Users/clint/Workspace/team-resourcer/frontend/src -name "MemberFormDialog.test.*"
# If found, update snapshots: npx vitest run --reporter=verbose src/components/members/MemberFormDialog.test.*
```

As of 2026-03-27 there are no tests for this component, so this check is precautionary.

---

## Risks

1. **`type="date"` in a narrower column** — At `max-w-lg` (~512px dialog), a 2-col grid gives roughly 230px per column. The native date picker input renders within this width on all major browsers without clipping. No action required, but verify visually on the narrowest viewport the app supports.

2. **Employee ID required error display in new position** — The `error` prop on `<Field>` renders an inline error message below the input. Moving Employee ID to the right column of a grid row does not affect error rendering — `Field` is self-contained. Verify by triggering the required validation (submit with empty Employee ID) to confirm the error appears in the correct column.

3. **No logic changes** — All `register()` calls, the Zod schema, `defaultValues`, `onSubmit` payload construction, and reset logic are unaffected by this change. If the implementer accidentally modifies any of these while editing the JSX block, TypeScript will catch type mismatches.
