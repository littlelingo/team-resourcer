---
feature: 022-remove-main-import-button
status: COMPLETE
complexity: LOW
testing_strategy: implement-then-test
created: 2026-03-28
depends_on: []
---

# PRP: Remove Main Import Nav Item and ImportPage

## Problem Statement

The sidebar navigation contains a dedicated "Import" nav item (route `/import`) that was the original entry point for bulk member imports. Every entity page now has its own inline import button wired to an `ImportWizard` dialog. The standalone `ImportPage` and its sidebar nav entry are fully redundant — no new user-facing functionality is being removed, only dead UI surface.

## Solution Overview

Three targeted removals, no backend changes, no test cleanup required:

1. Delete `frontend/src/pages/ImportPage.tsx` in its entirety.
2. Remove the `ImportPage` import statement and its `<Route>` from `frontend/src/App.tsx`.
3. Remove the Import nav entry from `frontend/src/components/layout/AppLayout.tsx` and clean up the now-unused `Upload` icon import.

After these changes, navigating to `/import` directly will fall through to the catch-all `<Navigate to="/members" replace />` already defined in `App.tsx` (line 17). That is acceptable — no explicit 404 route exists, so the redirect is graceful.

---

## Implementation Steps

### Step 1 — Delete ImportPage

**File to delete:** `/Users/clint/Workspace/team-resourcer/frontend/src/pages/ImportPage.tsx`

Delete the file entirely. It is 14 lines and has no content worth preserving — its sole imports (`PageHeader`, `ImportWizard`) remain in active use elsewhere in the codebase and are unaffected by this deletion.

**Validation:**
```bash
ls /Users/clint/Workspace/team-resourcer/frontend/src/pages/ImportPage.tsx
# Must return: No such file or directory
```

---

### Step 2 — Remove ImportPage from App.tsx

**File to modify:** `/Users/clint/Workspace/team-resourcer/frontend/src/App.tsx`

Remove line 11 — the `ImportPage` import:
```tsx
import ImportPage from '@/pages/ImportPage'
```

Remove line 28 — the `/import` route:
```tsx
<Route path="/import" element={<ImportPage />} />
```

No other changes to `App.tsx` are needed. The remaining routes and the catch-all `<Navigate to="/members" replace />` are untouched.

**Validation:**
```bash
grep -n "ImportPage\|/import" /Users/clint/Workspace/team-resourcer/frontend/src/App.tsx
# Must return no output
```

---

### Step 3 — Remove Import nav entry from AppLayout.tsx

**File to modify:** `/Users/clint/Workspace/team-resourcer/frontend/src/components/layout/AppLayout.tsx`

Remove line 11 — the Import nav item from the `navItems` array:
```tsx
{ label: 'Import', icon: Upload, path: '/import' },
```

On line 2, remove `Upload` from the `lucide-react` named import. The current import is:
```tsx
import { Users, Briefcase, Layers, Network, GitBranch, Upload, Building2 } from 'lucide-react'
```

After removal it becomes:
```tsx
import { Users, Briefcase, Layers, Network, GitBranch, Building2 } from 'lucide-react'
```

`Upload` is used exclusively for the Import nav item. All other icons in this import (`Users`, `Briefcase`, `Layers`, `Network`, `GitBranch`, `Building2`) remain in use in `navItems` or `treeNavItems`.

**Validation:**
```bash
grep -n "Upload\|Import\|/import" /Users/clint/Workspace/team-resourcer/frontend/src/components/layout/AppLayout.tsx
# Must return no output
```

---

### Step 4 — TypeScript and Build Verification

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend && npx tsc --noEmit
# Must pass with 0 errors

cd /Users/clint/Workspace/team-resourcer/frontend && npm run build
# Must complete without errors or warnings about ImportPage or Upload
```

---

### Step 5 — Manual Smoke Test

With the dev server running (`make dev` or `docker compose up`):

1. Confirm the "Import" entry no longer appears in the left sidebar.
2. Navigate directly to `http://localhost:5173/import` — the app should redirect to `/members` without a white screen or error.
3. Confirm all remaining nav items (`Members`, `Programs`, `Agencies`, `Functional Areas`, `Teams`, and all Tree Views) still render and their icons display correctly.
4. Confirm that the inline import buttons on `MembersPage`, `AgenciesPage`, `ProgramsPage`, `FunctionalAreasPage`, and `TeamsPage` still open their respective `ImportWizard` dialogs without error — these are unaffected by this change.

---

## File Manifest

| File | Action |
|---|---|
| `frontend/src/pages/ImportPage.tsx` | DELETE |
| `frontend/src/App.tsx` | MODIFY — remove `ImportPage` import (line 11) and `/import` route (line 28) |
| `frontend/src/components/layout/AppLayout.tsx` | MODIFY — remove Import nav entry (line 11) and `Upload` from lucide-react import (line 2) |

---

## Risks

1. **Direct `/import` URL bookmarks** — Any user with `/import` bookmarked will be silently redirected to `/members`. This is acceptable — the sidebar nav is the only advertised entry point and it is being removed.

2. **`Upload` icon used elsewhere** — `Upload` appears only in `AppLayout.tsx` within this codebase. Confirm with:
   ```bash
   grep -rn "Upload" /Users/clint/Workspace/team-resourcer/frontend/src/
   # Expected: only the AppLayout.tsx lines being removed
   ```
   If any other file imports `Upload` from lucide-react, those imports are independent and unaffected.

3. **`ImportPage` referenced anywhere else** — The page is only registered as a route in `App.tsx`. Confirm there are no other references before deleting:
   ```bash
   grep -rn "ImportPage" /Users/clint/Workspace/team-resourcer/frontend/src/
   # Expected: only the App.tsx import and route being removed
   ```

4. **No tests affected** — No test files cover `ImportPage`, `AppLayout`, or `App.tsx` routing. No test cleanup is required.
