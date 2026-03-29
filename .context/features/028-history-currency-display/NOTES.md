# Feature 028 — History Currency Display Fix

**Date:** 2026-03-28
**Status:** Research complete, ready for implementation

---

## Problem

The member detail sheet shows two sections that render salary/bonus numbers. They format identically in structure but produce different output:

- **Compensation section** — formats via `formatCurrency()` → `$120,000.00` (correct)
- **History timeline** — renders `entry.value` raw → `120000.00` (wrong)

The fix is to apply the same `formatCurrency` logic to history entries where `entry.field` is a financial field (`salary`, `bonus`, `pto_used`).

---

## Key Files

### Frontend

| File | Role |
|------|------|
| `frontend/src/components/members/MemberDetailSheet.tsx` | Primary fix target — contains both sections |
| `frontend/src/components/trees/panels/MemberDetailPanel.tsx` | Tree-view detail panel — has no history section at all (only shows org/contact/programs), no fix needed |
| `frontend/src/lib/member-utils.ts` | Only has `getInitials` helpers — no currency utils |
| `frontend/src/lib/utils.ts` | Only has `cn()` — no currency utils |
| `frontend/src/types/index.ts` | `MemberHistory.value` is typed as `string` (line 69) |

### Backend

| File | Role |
|------|------|
| `backend/app/services/import_commit.py` | Writes `MemberHistory` records — two code paths |
| `backend/app/services/import_mapper.py` | Normalizes numeric fields via `parse_amount()` before commit |
| `backend/app/models/member_history.py` | `value` is `Numeric(12, 2)` — serialized as string decimal |

---

## Compensation Section — "Good" Formatting

**Location:** `MemberDetailSheet.tsx` lines 17–29

Two local helper functions exist at the top of the file:

```typescript
function formatCurrency(value: string | null | undefined): string | null {
  if (!value) return null
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

function formatNumber(value: string | null | undefined): string | null {
  if (!value) return null
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return num.toString()
}
```

**Usage in compensation section (lines 216–233):**
- `member.salary` → `formatCurrency(member.salary)` → `$120,000.00`
- `member.bonus` → `formatCurrency(member.bonus)` → `$15,000.00`
- `member.pto_used` → `formatNumber(member.pto_used)` + ` hrs` → `40 hrs`

---

## History Section — "Bad" Formatting

**Location:** `MemberDetailSheet.tsx` lines 248–266

```tsx
<p className="mt-0.5 text-sm font-medium text-slate-700 capitalize">
  {entry.field.replace(/_/g, ' ')}
  {': '}
  <span className="font-normal">{entry.value}</span>
</p>
```

`entry.value` is rendered directly — it's a raw decimal string from the DB (`"120000.00"`, `"15000.00"`, `"40.00"`). No formatting is applied.

**The field names that need formatting:**
- `salary` → currency (`$120,000.00`)
- `bonus` → currency (`$15,000.00`)
- `pto_used` → number + ` hrs` (`40 hrs`)

---

## How to Fix

### Option A — Inline conditional (minimal change)

Replace `{entry.value}` with a ternary that checks `entry.field`:

```tsx
<span className="font-normal">
  {entry.field === 'pto_used'
    ? `${formatNumber(entry.value)} hrs`
    : entry.field === 'salary' || entry.field === 'bonus'
    ? formatCurrency(entry.value)
    : entry.value}
</span>
```

### Option B — Extract a shared utility (better long-term)

Move `formatCurrency` and `formatNumber` into `frontend/src/lib/member-utils.ts` (or a new `frontend/src/lib/format-utils.ts`) and import in both `MemberDetailSheet.tsx` and `MemberDetailPanel.tsx`. `MemberDetailPanel.tsx` currently has no history section, so no immediate consumer besides the sheet — but extracting now would be cleaner.

**Recommended:** Option B — extract to `frontend/src/lib/format-utils.ts`, import in `MemberDetailSheet.tsx`. The panel can adopt it if a history section is added later.

---

## Deduplication Check — Where Does It Happen?

The question of where "imported salary vs current salary" dedup happens depends on the import path:

### Path 1: Member import (member entity type)

`import_commit.py` → `_commit_members()` → `_append_history_if_changed()` (lines 87–112)

```python
async def _append_history_if_changed(db, member, field, new_value, is_new):
    ...
    existing = getattr(member, field, None)
    if is_new or existing != new_decimal:
        entry = MemberHistory(...)  # only written if value changed
        db.add(entry)
```

**Dedup key:** `is_new OR member.{field} != new_value`. Compares the *current scalar* on the TeamMember row against the incoming value. If they match, no history row is written.

### Path 2: Financial history import (salary_history / bonus_history / pto_history)

`import_commit.py` → `_commit_financial_history()` (lines 342–433)

```python
existing_result = await db.execute(
    select(MemberHistory).where(
        MemberHistory.member_uuid == member.uuid,
        MemberHistory.field == field_name,
        MemberHistory.value == amount,
        MemberHistory.effective_date == eff_date,
    )
)
if existing_result.scalar_one_or_none() is not None:
    continue  # exact duplicate found — skip
```

**Dedup key:** exact match on `(member_uuid, field, value, effective_date)`. A re-import of the same file will not create duplicate rows.

### Summary

The dedup already happens in the backend at commit time. No frontend work is needed for dedup logic. The only issue is display-side formatting.

---

## No Shared Formatting Utilities Exist

There is currently no currency/number formatting utility in:
- `frontend/src/lib/utils.ts` (only `cn()`)
- `frontend/src/lib/member-utils.ts` (only `getInitials`)
- Any other `frontend/src/lib/` file

The `formatCurrency` and `formatNumber` functions are **private to `MemberDetailSheet.tsx`** (lines 17–29). They need to be extracted or duplicated to be reusable.

---

## Data Flow Summary

```
CSV/Sheet upload
  → import_mapper.apply_mapping()
      → parse_amount() normalizes "$75,000" → "75000.00"
  → import_commit._commit_financial_history() or _commit_members()
      → dedup check (skips if value already matches)
      → MemberHistory row written with value=Decimal("75000.00")
      → PostgreSQL stores as Numeric(12,2)
  → API serializes as string "75000.00"
  → TeamMember.history[].value = "75000.00" in TypeScript
  → MemberDetailSheet history section renders "75000.00" raw ← BUG HERE
  → MemberDetailSheet compensation section renders "$75,000.00" ← correct path
```

---

## Implementation Checklist

- [ ] Create `frontend/src/lib/format-utils.ts` with exported `formatCurrency` and `formatNumber`
- [ ] Update `MemberDetailSheet.tsx` to import from `format-utils` instead of local helpers
- [ ] Update history `<span>` to apply `formatCurrency` for `salary`/`bonus` and `formatNumber` + ` hrs` for `pto_used`
- [ ] Add/update tests for `format-utils`
- [ ] Verify `MemberDetailSheet` tests still pass
