# Feature 022: Remove Main Import Nav Item and ImportPage

## Context

The sidebar navigation has a dedicated "Import" nav item (route `/import`) that was the original
entry point for member imports. Since then, every major entity page has grown its own import button
that opens an `ImportWizard` dialog inline. The standalone `/import` route and its nav entry are now
redundant and should be removed.

---

## Current State of the Import Button / Page

### 1. Sidebar nav entry — `AppLayout.tsx` (line 11)

`/Users/clint/Workspace/team-resourcer/frontend/src/components/layout/AppLayout.tsx`

```tsx
// line 11
{ label: 'Import', icon: Upload, path: '/import' },
```

This is inside the `navItems` array (lines 5–12). It renders a NavLink in the left sidebar with an
`Upload` icon. Removing this entry removes the nav link.

The `Upload` icon is imported from `lucide-react` (line 2) and is used **only** for this nav item —
removing the nav entry also makes the `Upload` import dead.

### 2. Route definition — `App.tsx` (line 28)

`/Users/clint/Workspace/team-resourcer/frontend/src/App.tsx`

```tsx
// line 28
<Route path="/import" element={<ImportPage />} />
```

Also: `ImportPage` is imported on line 11. Both the import and the route must be removed.

### 3. ImportPage component — `ImportPage.tsx`

`/Users/clint/Workspace/team-resourcer/frontend/src/pages/ImportPage.tsx`

A thin wrapper: renders a `PageHeader` titled "Import Members" and an `<ImportWizard />` with no
`entityType` prop (defaults to `'member'` on the backend). Only 14 lines. The file itself should be
deleted entirely.

---

## Sections That Now Handle Their Own Imports

All four entity pages below follow an identical pattern:
- `importOpen` boolean state
- An "Import" button in the `PageHeader` `actions` that calls `setImportOpen(true)`
- A `Dialog.Root` at the bottom of JSX wired to `importOpen`
- `<ImportWizard entityType="..." onComplete={() => setImportOpen(false)} />`

| Page | File | Entity type | Button line | Dialog line |
|---|---|---|---|---|
| AgenciesPage | `frontend/src/pages/AgenciesPage.tsx` | `"agency"` | 62 | 109 |
| ProgramsPage | `frontend/src/pages/ProgramsPage.tsx` | `"program"` | 155 | 208 |
| FunctionalAreasPage | `frontend/src/pages/FunctionalAreasPage.tsx` | `"area"` | 62 | 109 |
| TeamsPage | `frontend/src/pages/TeamsPage.tsx` | `"team"` | ~40 (importOpen state) | ~last dialog block |

### MembersPage — more complex

`/Users/clint/Workspace/team-resourcer/frontend/src/pages/MembersPage.tsx`

Members already has its import handled inline with a **dropdown** (not a simple button) that lets
the user choose between four entity types:

- Import Members (`member`)
- Import Salary History (`salary_history`)
- Import Bonus History (`bonus_history`)
- Import PTO History (`pto_history`)

The dropdown trigger is at line 168–201. State is `importEntityType: EntityType | null` (line 47).
The `Dialog.Root` + `ImportWizard` are at lines 321–347.

---

## What Needs to Change

1. **Delete** `/Users/clint/Workspace/team-resourcer/frontend/src/pages/ImportPage.tsx` — the entire file.

2. **`App.tsx`** — remove the `ImportPage` import (line 11) and its `<Route>` (line 28).

3. **`AppLayout.tsx`** — remove the `{ label: 'Import', icon: Upload, path: '/import' }` entry from
   `navItems` (line 11). Then remove the `Upload` import from `lucide-react` (line 2) since it will
   be unused.

---

## Dependencies and Risks

- **No tests** cover `ImportPage`, `AppLayout`, or `App.tsx` — no test cleanup needed.
- **Dead route**: after removal, navigating to `/import` will fall through to the catch-all
  `<Navigate to="/members" replace />` (App.tsx line 17). That is fine — no explicit 404 route
  exists, so the redirect is graceful.
- **`Upload` icon**: only used for the Import nav item in `AppLayout.tsx`. Removing the nav entry
  leaves the `Upload` import unused. Must be cleaned up or the linter will flag it.
- **`ImportWizard` with no `entityType`**: `ImportPage` renders `<ImportWizard />` with no prop,
  relying on the backend default (`member`). This capability now lives in `MembersPage` via the
  dropdown. No functionality is lost.
- **No backend changes**: the `/api/import/*` routes are still needed by all the section-level
  import dialogs. Nothing on the API layer changes.
- **`ResultStep.tsx` "Go to Members" link**: the result step of the wizard has a hardcoded
  "Go to Members" link. That link navigates to `/members`, not `/import`, so it is unaffected.
