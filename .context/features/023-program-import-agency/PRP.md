---
feature: 023-program-import-agency
status: COMPLETE
complexity: LOW
testing_strategy: implement-then-test
created: 2026-03-28
depends_on: []
---

# PRP: Program Import — Agency Column Support

## Problem Statement

The backend already supports resolving `agency_name` during program import (lookup by exact name, skip if not found). However, the frontend `PROGRAM_TARGET_FIELDS` array in `MapColumnsStep.tsx` does not include `agency_name`, so users cannot map an agency column from their CSV/sheet during program import.

## Solution Overview

Add one entry to `PROGRAM_TARGET_FIELDS` in the frontend. No backend changes needed.

---

## Implementation Steps

### Step 1 — Add agency_name to PROGRAM_TARGET_FIELDS

**File to modify:** `frontend/src/components/import/MapColumnsStep.tsx`

Add `{ label: 'Agency', value: 'agency_name' }` to the `PROGRAM_TARGET_FIELDS` array (after the `description` entry):

```typescript
export const PROGRAM_TARGET_FIELDS: TargetField[] = [
  { label: 'Name', value: 'name' },
  { label: 'Description', value: 'description' },
  { label: 'Agency', value: 'agency_name' },
]
```

**Validation:**
```bash
grep -n "agency_name" frontend/src/components/import/MapColumnsStep.tsx
# Must return the new line
```

---

### Step 2 — TypeScript verification

```bash
cd frontend && npx tsc --noEmit
# Must pass with 0 errors
```

---

### Step 3 — Manual smoke test

1. Start dev server
2. Go to Programs page, click Import
3. Upload a CSV with columns: Name, Description, Agency
4. In the mapping step, verify "Agency" appears as a target field option
5. Complete the import — programs with matching agency names should have the agency linked

---

## File Manifest

| File | Action |
|---|---|
| `frontend/src/components/import/MapColumnsStep.tsx` | MODIFY — add agency_name to PROGRAM_TARGET_FIELDS |

## Risks

1. **Silent skip** — Unmatched agency names don't produce errors; program is created with no agency. Consistent with existing FK resolution patterns.
2. **Case sensitivity** — "va" won't match "VA". Pre-existing backend behavior, not introduced by this change.
