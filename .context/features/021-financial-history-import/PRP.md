---
feature: 021-financial-history-import
status: VALIDATED
complexity: HIGH
testing_strategy: implement-then-test
created: 2026-03-27
depends_on: 018-member-name-split
---

# PRP: Financial History Import (Salary, Bonus, PTO)

## Problem Statement

Members' salary, bonus, and PTO history cannot currently be imported as standalone operations. The only path is through a full member import, which rewrites all member scalars and logs history only for changes detected on that day. There is no way to backfill historical records with explicit `effective_date` values, and there is no UI affordance on the Members page for any kind of import at all.

## Solution Overview

Add three new entity types — `salary_history`, `bonus_history`, `pto_history` — to the existing 4-step import wizard. Each type shares the same shape: `employee_id`, `effective_date`, `amount` (maps to `value` on `MemberHistory`), and optional `notes`. A single shared `_commit_financial_history()` function handles all three by accepting a `field_name` parameter. After inserting history records, it checks whether any imported row represents the most recent entry for that member+field and, if so, updates the `TeamMember` scalar. Unmatched `employee_id` values are collected as `error_rows` and surface in the existing `ResultStep` error accordion with no UI changes required to that component.

On the frontend, the Members page gains a dropdown button that replaces the missing import affordance. The dropdown offers four options: Import Members, Import Salary History, Import Bonus History, Import PTO History. Each option opens a modal containing `ImportWizard` with the appropriate `entityType`. The wizard's `ENTITY_CONFIGS` map in `ImportWizard.tsx` is extended with the three new history types, wiring in the new target-field constants from `MapColumnsStep.tsx`.

---

## Critical Pre-Implementation Risk: `dedup_field = None` will break `_dedup_rows`

The `EntityConfig` dataclass declares `dedup_field: str = "name"`. The `_dedup_rows` function does `data.get(dedup_field, "")`. If `dedup_field` is `None`, every row resolves to key `""` and only the first row survives dedup — all others are silently dropped. The history entity configs must not pass `None` to the current code as-is.

The fix is a two-part change in **Step 1b** (described below): change the `EntityConfig` type annotation to `str | None = None` and add a guard in `commit_import()` to skip `_dedup_rows` when `dedup_field is None`, passing `valid_rows` through unchanged.

---

## Implementation Steps

### Step 1 — Extend `EntityType` in `import_schemas.py`

**File:** `backend/app/schemas/import_schemas.py`

Change the `EntityType` Literal on line 9 from:
```
EntityType = Literal["member", "program", "area", "team", "agency"]
```
to:
```
EntityType = Literal["member", "program", "area", "team", "agency", "salary_history", "bonus_history", "pto_history"]
```

No other changes to this file.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -c "from app.schemas.import_schemas import EntityType; print('ok')"
```

---

### Step 2 — Add entity configs and fix `dedup_field` null safety in `import_mapper.py`

**File:** `backend/app/services/import_mapper.py`

**2a. Fix `EntityConfig` type annotation.** Change the `dedup_field` field on the dataclass from:
```python
dedup_field: str = "name"
```
to:
```python
dedup_field: str | None = None
```

**2b. Fix the dedup logic in `apply_mapping()`.** The dedup block (lines 147–157) reads `data.get(config.dedup_field, "")`. Wrap the entire dedup block so it only executes when `config.dedup_field is not None`:
```python
if config.dedup_field is not None:
    dedup_val = data.get(config.dedup_field, "")
    if dedup_val:
        ...  # existing dedup code unchanged
```

**2c. Update existing entity configs** to use explicit keyword arguments for `dedup_field` where they currently rely on the default. The existing configs all pass `dedup_field="employee_id"` or `dedup_field="name"` — no changes needed there; they are already explicit on the `member` config and implicit-defaulting on the others. After changing the default from `"name"` to `None`, the `program`, `area`, `team`, and `agency` configs that did NOT set `dedup_field` will now dedup on `None` (i.e., no dedup). These configs should be given explicit `dedup_field="name"` to preserve existing behavior.

Check the current configs:
- `member`: already has `dedup_field="employee_id"` — no change needed.
- `program`: no explicit `dedup_field` — add `dedup_field="name"`.
- `area`: no explicit `dedup_field` — add `dedup_field="name"`.
- `team`: no explicit `dedup_field` — add `dedup_field="name"`.
- `agency`: no explicit `dedup_field` — add `dedup_field="name"`.

**2d. Add a `_validate_effective_date` validator function** (parallel to the existing `_validate_hire_date`):
```python
def _validate_effective_date(data: dict[str, Any], errors: list[str]) -> None:
    val = data.get("effective_date")
    if val and val != "":
        try:
            date.fromisoformat(str(val))
        except ValueError:
            errors.append(f"'effective_date' must be ISO date format (YYYY-MM-DD), got '{val}'.")
```

**2e. Add the three new entity configs** to `ENTITY_CONFIGS`:
```python
"salary_history": EntityConfig(
    target_fields={"employee_id", "effective_date", "amount", "notes"},
    required_fields={"employee_id", "effective_date", "amount"},
    numeric_fields={"amount"},
    dedup_field=None,
    validators=[_validate_effective_date],
),
"bonus_history": EntityConfig(
    target_fields={"employee_id", "effective_date", "amount", "notes"},
    required_fields={"employee_id", "effective_date", "amount"},
    numeric_fields={"amount"},
    dedup_field=None,
    validators=[_validate_effective_date],
),
"pto_history": EntityConfig(
    target_fields={"employee_id", "effective_date", "amount", "notes"},
    required_fields={"employee_id", "effective_date", "amount"},
    numeric_fields={"amount"},
    dedup_field=None,
    validators=[_validate_effective_date],
),
```

The field name `amount` is used as the canonical CSV column name (it maps to `MemberHistory.value`). This is intentional: callers write a CSV with a column named `amount`, map it to the `amount` target field, and the commit function reads `row.data["amount"]` to populate `MemberHistory.value`.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -c "
from app.services.import_mapper import ENTITY_CONFIGS
for k, v in ENTITY_CONFIGS.items():
    print(k, v.dedup_field)
"
# Expected: member employee_id, program name, area name, team name, agency name,
#           salary_history None, bonus_history None, pto_history None
```

---

### Step 3 — Fix `_dedup_rows` guard in `commit_import()` in `import_commit.py`

**File:** `backend/app/services/import_commit.py`

In `commit_import()`, the current lines:
```python
dedup_field = ENTITY_CONFIGS[entity_type].dedup_field
deduped_valid = _dedup_rows(valid_rows, dedup_field)
dedup_skipped = len(valid_rows) - len(deduped_valid)
```

Must be changed to:
```python
dedup_field = ENTITY_CONFIGS[entity_type].dedup_field
if dedup_field is not None:
    deduped_valid = _dedup_rows(valid_rows, dedup_field)
    dedup_skipped = len(valid_rows) - len(deduped_valid)
else:
    deduped_valid = valid_rows
    dedup_skipped = 0
```

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -c "from app.services.import_commit import commit_import; print('ok')"
```

---

### Step 4 — Add `_commit_financial_history()` and wire dispatch in `import_commit.py`

**File:** `backend/app/services/import_commit.py`

**4a. Add the function.** Place it after the existing `_commit_agencies` function and before `_commit_members`. The function signature:

```python
async def _commit_financial_history(
    db: AsyncSession,
    rows: list[MappedRow],
    error_rows: list[MappedRow],
    field_name: str,
) -> tuple[int, int]:
```

Logic (describe, no code in PRP):

1. **Build an employee_id lookup dict upfront.** Execute a single `select(TeamMember)` query (no WHERE clause — or use `IN` if the row count is large). Build `emp_lookup: dict[str, TeamMember]` keyed on `member.employee_id`.

   Preferred approach: collect the set of `employee_id` values from all rows first, then query `select(TeamMember).where(TeamMember.employee_id.in_(emp_ids))` and build the dict. This is O(1) lookups for the rest of the function and avoids N queries.

2. **Tracking dict for affected members.** Maintain `affected: dict[str, list[date]]` — keys are `employee_id`, values are lists of `effective_date` objects for rows that were successfully inserted in this import batch. This is used in the post-loop scalar update pass.

3. **Per-row loop.** For each `row` in `rows`:
   - Extract `emp_id = str(row.data.get("employee_id", "")).strip()`
   - If `emp_id` not in `emp_lookup`: append a new `MappedRow` (copy of the row but with `errors=["No member found with employee_id '{emp_id}'"]`) to `error_rows`; continue.
   - Extract `amount_raw = row.data.get("amount")`. Parse to `Decimal`. If invalid (catch `InvalidOperation`), append an error row and continue — this should not happen after mapper validation but is a defensive guard.
   - Extract `effective_date_raw = row.data.get("effective_date")`. Parse via `date.fromisoformat(str(effective_date_raw))`. If invalid, append an error row and continue.
   - Extract `notes = row.data.get("notes")` — may be `None` or `""`.
   - **Dedup check**: query `select(MemberHistory)` where `member_uuid == member.uuid AND field == field_name AND value == amount AND effective_date == eff_date`. If a row exists, skip (do not count as error, do not count as created — just silently skip). Increment a local `skipped_dupes` counter for informational purposes (this does NOT affect the returned tuple; see note below).
   - If no duplicate: create a `MemberHistory` record using `create_history_entry()` from `app.services.history_service`. Increment `created_count`. Append `eff_date` to `affected[emp_id]`.

4. **Post-loop scalar update pass.** For each `emp_id` in `affected`:
   - Member is already in `emp_lookup`.
   - Query the maximum `effective_date` for this member+field across ALL history records (not just the imported batch): `select(func.max(MemberHistory.effective_date)).where(MemberHistory.member_uuid == member.uuid, MemberHistory.field == field_name)`.
   - If the max effective_date equals any date in `affected[emp_id]` (i.e., at least one imported row is the latest), update the scalar: `setattr(member, field_name, <the value from the most-recent imported row for this member>)`.
   - To find the value: among all rows for this `emp_id` in the original `rows` list, find the one with the maximum `effective_date` that matches the overall max. Set `member.salary` / `member.bonus` / `member.pto_used` accordingly.
   - Call `await db.flush()` after each member update.

5. **Return value.** Return `(created_count, 0)`. The `updated_count` position is `0` — history records are only ever created, not updated. Scalar updates to the member are a side effect and do not count as "updated members" in the summary.

   Note on `skipped_dupes`: duplicate history rows are silently dropped. They are not added to `error_rows` (they are not errors) and do not inflate `skipped_count`. This keeps the results summary clean.

**4b. Update the dispatch block in `commit_import()`.** Change the `if/elif/else` chain to:

```python
if entity_type == "area":
    created, updated = await _commit_areas(db, deduped_valid)
elif entity_type == "program":
    created, updated = await _commit_programs(db, deduped_valid)
elif entity_type == "team":
    created, updated = await _commit_teams(db, deduped_valid)
elif entity_type == "agency":
    created, updated = await _commit_agencies(db, deduped_valid)
elif entity_type == "salary_history":
    created, updated = await _commit_financial_history(db, deduped_valid, error_rows, "salary")
elif entity_type == "bonus_history":
    created, updated = await _commit_financial_history(db, deduped_valid, error_rows, "bonus")
elif entity_type == "pto_history":
    created, updated = await _commit_financial_history(db, deduped_valid, error_rows, "pto_used")
else:
    created, updated = await _commit_members(db, deduped_valid, error_rows)
```

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -c "from app.services.import_commit import _commit_financial_history; print('ok')"
```

---

### Step 5 — Add target-field constants in `MapColumnsStep.tsx`

**File:** `frontend/src/components/import/MapColumnsStep.tsx`

Add three new exported constants after `TEAM_TARGET_FIELDS` (after line 53):

```typescript
export const SALARY_HISTORY_TARGET_FIELDS: TargetField[] = [
  { label: 'Employee ID', value: 'employee_id' },
  { label: 'Effective Date', value: 'effective_date' },
  { label: 'Amount', value: 'amount' },
  { label: 'Notes', value: 'notes' },
]

export const BONUS_HISTORY_TARGET_FIELDS: TargetField[] = [
  { label: 'Employee ID', value: 'employee_id' },
  { label: 'Effective Date', value: 'effective_date' },
  { label: 'Amount', value: 'amount' },
  { label: 'Notes', value: 'notes' },
]

export const PTO_HISTORY_TARGET_FIELDS: TargetField[] = [
  { label: 'Employee ID', value: 'employee_id' },
  { label: 'Effective Date', value: 'effective_date' },
  { label: 'Amount', value: 'amount' },
  { label: 'Notes', value: 'notes' },
]
```

All three are identical in shape. They are kept as separate constants so callers can evolve them independently if field sets diverge in the future, and so the label in the MapColumns UI matches the import type context.

No other changes to `MapColumnsStep.tsx`.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend
npx tsc --noEmit 2>&1 | grep MapColumnsStep
# Must return no output
```

---

### Step 6 — Add the three new entity types to `EntityType` and `ENTITY_CONFIGS` in the frontend

**File:** `frontend/src/api/importApi.ts`

Change line 12 from:
```typescript
export type EntityType = 'member' | 'program' | 'area' | 'team' | 'agency'
```
to:
```typescript
export type EntityType = 'member' | 'program' | 'area' | 'team' | 'agency' | 'salary_history' | 'bonus_history' | 'pto_history'
```

No other changes to this file.

**File:** `frontend/src/components/import/ImportWizard.tsx`

**6a. Update the import line** at the top. Add the three new field constants to the named imports from `'./MapColumnsStep'`:
```typescript
import MapColumnsStep, {
  MEMBER_TARGET_FIELDS,
  PROGRAM_TARGET_FIELDS,
  AREA_TARGET_FIELDS,
  AGENCY_TARGET_FIELDS,
  TEAM_TARGET_FIELDS,
  SALARY_HISTORY_TARGET_FIELDS,
  BONUS_HISTORY_TARGET_FIELDS,
  PTO_HISTORY_TARGET_FIELDS,
  type TargetField,
} from './MapColumnsStep'
```

**6b. Extend `ENTITY_CONFIGS`** by adding three new entries after the `agency` entry:
```typescript
salary_history: {
  targetFields: SALARY_HISTORY_TARGET_FIELDS,
  requiredFields: ['employee_id', 'effective_date', 'amount'],
},
bonus_history: {
  targetFields: BONUS_HISTORY_TARGET_FIELDS,
  requiredFields: ['employee_id', 'effective_date', 'amount'],
},
pto_history: {
  targetFields: PTO_HISTORY_TARGET_FIELDS,
  requiredFields: ['employee_id', 'effective_date', 'amount'],
},
```

No changes to the wizard state machine, step rendering, or `ResultStep` — those already handle any `entityType` generically.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend
npx tsc --noEmit 2>&1 | grep -E "importApi|ImportWizard|MapColumnsStep"
# Must return no output
```

---

### Step 7 — Add import dropdown to `MembersPage.tsx`

**File:** `frontend/src/pages/MembersPage.tsx`

MembersPage currently has no import affordance. Add a dropdown button in the `PageHeader` `actions` prop, between the view toggle and the "Add Member" button.

**7a. New imports to add** at the top of the file:
```typescript
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Dialog from '@radix-ui/react-dialog'
import { Upload, ChevronDown } from 'lucide-react'
import ImportWizard from '@/components/import/ImportWizard'
import type { EntityType } from '@/api/importApi'
```

**7b. New state variables** in the component body (add after existing local UI state declarations around line 43):
```typescript
const [importEntityType, setImportEntityType] = useState<EntityType | null>(null)
```
`null` means the dialog is closed. Any non-null `EntityType` value means the dialog is open with that type.

**7c. Dropdown button markup.** In the `actions` prop of `<PageHeader>`, add the following between the view toggle and the "Add Member" button:

```tsx
<DropdownMenu.Root>
  <DropdownMenu.Trigger asChild>
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
    >
      <Upload className="h-4 w-4" />
      Import
      <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
    </button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Portal>
    <DropdownMenu.Content
      align="end"
      sideOffset={6}
      className="z-50 min-w-[200px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md"
    >
      {(
        [
          { label: 'Import Members', type: 'member' },
          { label: 'Import Salary History', type: 'salary_history' },
          { label: 'Import Bonus History', type: 'bonus_history' },
          { label: 'Import PTO History', type: 'pto_history' },
        ] as { label: string; type: EntityType }[]
      ).map(({ label, type }) => (
        <DropdownMenu.Item
          key={type}
          onSelect={() => setImportEntityType(type)}
          className="cursor-pointer px-3 py-2 text-sm text-slate-700 outline-none hover:bg-slate-50 focus:bg-slate-50"
        >
          {label}
        </DropdownMenu.Item>
      ))}
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
```

**7d. Import dialog.** Add the following at the bottom of the JSX return, after the existing `<ConfirmDialog>`:

```tsx
<Dialog.Root
  open={importEntityType !== null}
  onOpenChange={(open) => {
    if (!open) setImportEntityType(null)
  }}
>
  <Dialog.Portal>
    <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
    <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-0 shadow-xl max-h-[90vh] overflow-y-auto">
      <Dialog.Title className="sr-only">
        {importEntityType === 'member'
          ? 'Import Members'
          : importEntityType === 'salary_history'
            ? 'Import Salary History'
            : importEntityType === 'bonus_history'
              ? 'Import Bonus History'
              : 'Import PTO History'}
      </Dialog.Title>
      {importEntityType && (
        <ImportWizard
          entityType={importEntityType}
          onComplete={() => setImportEntityType(null)}
        />
      )}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

Note: `@radix-ui/react-dropdown-menu` must already be installed. Verify:
```bash
grep "@radix-ui/react-dropdown-menu" /Users/clint/Workspace/team-resourcer/frontend/package.json
```
If missing, install manually (do not use the shadcn CLI):
```bash
cd /Users/clint/Workspace/team-resourcer/frontend
npm install @radix-ui/react-dropdown-menu
```

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/frontend
npx tsc --noEmit 2>&1 | grep MembersPage
# Must return no output
```

---

### Step 8 — Verify `ResultStep.tsx` requires no changes

**File:** `frontend/src/components/import/ResultStep.tsx`

Review the component — it renders:
- Three summary cards: `created_count`, `updated_count`, `skipped_count`
- An error accordion showing `error_rows` when `error_rows.length > 0`, with row index, errors (joined by `"; "`), and raw data

For history imports:
- `created_count` = number of history records inserted
- `updated_count` = `0` (always, per Step 4 contract)
- `skipped_count` = number of rows that had mapper validation errors
- `error_rows` = rows where `employee_id` was not found (appended inside `_commit_financial_history`)

The error message for unmatched employee_ids will be `"No member found with employee_id 'EMP123'"` — this is a plain string and will display cleanly in the existing error accordion.

The "Go to Members" link at the bottom of `ResultStep.tsx` (line 107) is hardcoded to `/members`, which is appropriate for all history import types.

**No changes needed to `ResultStep.tsx`.**

---

### Step 9 — Backend integration tests

**Test file to create:** `backend/tests/services/test_import_financial_history.py`

Use the in-memory SQLite + `aiosqlite` pattern established in the project (see memory `planning_sqlite_test_db.md`): `AsyncSession` with `asyncio_mode=auto`, unique `employee_id` values per test for isolation, no `@pytest.mark.asyncio` decorator.

Test cases to cover:

1. **`test_commit_salary_history_creates_record`** — Single valid row with known `employee_id`, `effective_date`, `amount`. After commit: one `MemberHistory` row exists with `field="salary"`, `value=Decimal(amount)`, `effective_date=parsed date`. Member scalar `salary` updated because this is the only (and therefore most-recent) history entry.

2. **`test_commit_bonus_history_creates_record`** — Same as above but `field_name="bonus"`.

3. **`test_commit_pto_history_creates_record`** — Same but `field_name="pto_used"`.

4. **`test_commit_financial_history_unmatched_employee_id`** — Row with `employee_id` that does not exist in `team_members`. After commit: `created_count=0`, the row appears in `error_rows`, error message contains the unknown `employee_id`.

5. **`test_commit_financial_history_dedup_skips_exact_duplicate`** — Pre-insert a `MemberHistory` record. Submit a row with identical `(member_uuid, field, value, effective_date)`. After commit: still only one `MemberHistory` row exists (duplicate was skipped silently). The row does NOT appear in `error_rows`.

6. **`test_commit_financial_history_updates_scalar_for_most_recent`** — Two rows for the same member: `effective_date="2024-01-01"` with `amount=80000` and `effective_date="2025-06-01"` with `amount=90000`. After commit: `MemberHistory` has two records; `TeamMember.salary == Decimal("90000.00")` (the most-recent one wins).

7. **`test_commit_financial_history_does_not_update_scalar_if_older`** — Pre-set member's `salary` to `Decimal("100000")` and pre-insert a `MemberHistory` record for `effective_date="2026-01-01"`. Import a row with `effective_date="2024-01-01"`, `amount=70000`. After commit: the new history record is created, but `member.salary` remains `Decimal("100000")` (the imported record is not the most recent).

8. **`test_apply_mapping_validates_effective_date`** — Pass a row with `effective_date="not-a-date"` to `apply_mapping()` for `salary_history`. Assert `error_count == 1` and the error message contains `"effective_date"`.

9. **`test_apply_mapping_validates_amount_numeric`** — Pass a row with `amount="abc"` for `salary_history`. Assert `error_count == 1` and error contains `"amount"`.

**Validation:**
```bash
cd /Users/clint/Workspace/team-resourcer/backend
python -m pytest tests/services/test_import_financial_history.py -v
# All 9 tests must pass
```

---

### Step 10 — Manual end-to-end validation

Prepare two CSV files:

**`salary_test.csv`** (use real `employee_id` values from your local seed data plus one fake):
```
employee_id,effective_date,salary_amount,notes
EMP001,2024-01-15,85000,Q1 2024 review
EMP002,2024-06-01,92000,Promotion
EMP-INVALID,2024-01-01,50000,This should fail
```

Steps:
1. Start the app: `make dev` from `/Users/clint/Workspace/team-resourcer`
2. Navigate to Members page
3. Click the "Import" dropdown button
4. Select "Import Salary History"
5. Upload `salary_test.csv`
6. In Map Columns: confirm `employee_id` auto-suggests to Employee ID, `effective_date` to Effective Date, `salary_amount` to Amount. Map `notes` to Notes.
7. Click Preview — confirm EMP001 and EMP002 show green, EMP-INVALID shows an error (the mapper does not know about invalid employee_ids at preview time — validation happens at commit; the preview step shows all 3 rows as valid since `employee_id` format is not checked until commit)
8. Click Commit
9. Result step shows: Created 2, Updated 0, Skipped 1; accordion shows 1 skipped row with message "No member found with employee_id 'EMP-INVALID'"
10. Verify in the database or via API: `GET /api/members/{uuid}/history` for EMP001 — confirms one `MemberHistory` record with `field="salary"`, correct value, correct `effective_date`.
11. Verify EMP001's `TeamMember.salary` scalar equals the imported amount (if 2024-01-15 is more recent than any existing salary history for that member).

---

## File Manifest

| File | Action |
|------|--------|
| `backend/app/schemas/import_schemas.py` | Modify — extend `EntityType` Literal |
| `backend/app/services/import_mapper.py` | Modify — fix `dedup_field` annotation, add null guard, add `_validate_effective_date`, add 3 configs, add explicit `dedup_field="name"` to `program`/`area`/`team`/`agency` configs |
| `backend/app/services/import_commit.py` | Modify — add null guard around `_dedup_rows`, add `_commit_financial_history()`, extend dispatch block |
| `frontend/src/api/importApi.ts` | Modify — extend `EntityType` union |
| `frontend/src/components/import/MapColumnsStep.tsx` | Modify — add 3 exported `*_TARGET_FIELDS` constants |
| `frontend/src/components/import/ImportWizard.tsx` | Modify — import 3 new constants, extend `ENTITY_CONFIGS` |
| `frontend/src/pages/MembersPage.tsx` | Modify — add import state, dropdown button, import dialog |
| `backend/tests/services/test_import_financial_history.py` | Create — 9 integration tests |

---

## Validation Criteria

- `python -c "from app.schemas.import_schemas import EntityType"` succeeds with no errors
- All existing entity types continue to dedup correctly (regression check — `program`, `area`, `team`, `agency` configs must have explicit `dedup_field="name"`)
- `apply_mapping()` rejects rows with non-ISO `effective_date` values for all 3 history types
- `apply_mapping()` rejects rows with non-numeric `amount` values
- `_commit_financial_history()` creates `MemberHistory` records with the correct `field` value (`"salary"`, `"bonus"`, or `"pto_used"`)
- Unmatched `employee_id` rows surface in `CommitResult.error_rows` with a descriptive message
- Exact-duplicate history rows (same uuid + field + value + effective_date) are silently skipped — not error rows, not double-counted
- `TeamMember` scalar is updated only when the imported row has the most-recent `effective_date` for that field
- `npx tsc --noEmit` passes with zero errors across `importApi.ts`, `ImportWizard.tsx`, `MapColumnsStep.tsx`, and `MembersPage.tsx`
- All 9 backend integration tests pass
- Manual flow: 2 valid + 1 invalid employee_id CSV produces Created=2, Skipped=1, error accordion shows the invalid row

---

## Risks and Gotchas

1. **`dedup_field` null default change breaks existing configs** — The existing `program`, `area`, `team`, `agency` configs currently rely on the `dedup_field="name"` default. After changing the default to `None`, they must be updated to `dedup_field="name"` explicitly or dedup stops working for those types. This is Step 2c — do not skip it.

2. **`error_rows` mutation inside `_commit_financial_history`** — The function receives `error_rows` as a mutable list and appends to it directly. This mirrors the pattern used by `_commit_members` (which also appends to `error_rows` via `resolve_supervisors`). The `CommitResult.skipped_count` is computed as `len(error_rows) + dedup_skipped` after the commit function returns, so appended error rows are automatically counted. No change to `commit_import()` return logic is needed.

3. **`amount` vs `value` naming** — The CSV target field is named `amount` (what importers write in their spreadsheet). The `MemberHistory` model column is `value`. The commit function bridges this: `row.data["amount"]` → `MemberHistory.value`. Do not rename the `MemberHistory` column or the target field — keep the mismatch explicit in the commit function's local variable naming.

4. **`@radix-ui/react-dropdown-menu` may not be installed** — `MembersPage.tsx` currently uses `@radix-ui/react-toggle-group` but not the dropdown. Check `package.json` before writing the import. See Step 7 for the install command.

5. **`pto_used` vs `pto` naming** — The `HistoryFieldEnum` in `member_history.py` uses `pto_used = "pto_used"`. The `TeamMember` scalar column is also `pto_used`. The `_commit_financial_history` function for PTO must pass `field_name="pto_used"` (with the underscore). The entity type key is `pto_history` (no underscore in the type name). Do not conflate the two.

6. **Preview step does not validate employee_id existence** — The preview step (mapper validation) can only validate format/type. Employee_id lookup happens at commit time. This means the Preview step will show all rows as valid even if some employee_ids do not exist. The error accordion in `ResultStep` is the correct place for these failures — this is by design and consistent with how missing FKs are handled elsewhere in the import system.

7. **SQLite test DB and `func.max`** — The `func.max(MemberHistory.effective_date)` query in `_commit_financial_history` must work under SQLite for tests. SQLite supports `MAX()` on Date columns stored as ISO strings. The in-memory test setup (see memory `planning_sqlite_test_db.md`) is compatible.
