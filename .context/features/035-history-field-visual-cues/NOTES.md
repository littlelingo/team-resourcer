# Research: History Field Visual Cues

## Problem

The member history timeline renders all entries (salary, bonus, pto_used) identically — same blue dot, same plain text label. There's no visual way to quickly scan which field type changed. Users want to distinguish salary changes from bonus changes at a glance.

**Note**: The import behavior for bonus/pto_used already follows the same no-history-on-new-member rule as salary (feature 033 fix applies to all `_FINANCIAL_FIELDS`).

## Current State

### History timeline rendering

`frontend/src/components/members/MemberDetailSheet.tsx`, lines 233-267:

- Timeline connector: `border-l-2 border-blue-100` (uniform blue)
- Dot: `border-blue-300 bg-white` (same for all entries)
- Label: `{entry.field.replace(/_/g, ' ')}` — plain capitalized text, no color
- Value: Already formatted per field type (feature 028): `formatCurrency` for salary/bonus, `formatNumber + " hrs"` for pto_used
- No badges, icons, or color coding by field type

### Data model

- `MemberHistory.field` is `String(20)` in backend, `string` in frontend types
- Possible values: `"salary"`, `"bonus"`, `"pto_used"` (from `_FINANCIAL_FIELDS`)

## Proposed Approach: Colored Dot + Badge

### 1. Color-coded timeline dot per field type

Replace uniform `border-blue-300 bg-white` with per-field colors:

| Field | Color | Rationale |
|-------|-------|-----------|
| `salary` | `emerald` (green) | Money/income; not used elsewhere in detail sheet |
| `bonus` | `violet` (purple) | Reward; distinct and unused |
| `pto_used` | `amber` (yellow) | Time; consistent with app's amber=time convention |

### 2. Colored badge replacing plain text label

Replace `{entry.field.replace(/_/g, ' ')}` with a colored pill badge matching the existing Programs badge pattern (`rounded-full px-2 py-0.5 text-xs font-medium`):

- `Salary` → `bg-emerald-50 text-emerald-700`
- `Bonus` → `bg-violet-50 text-violet-700`
- `PTO` → `bg-amber-50 text-amber-700`

This is consistent with the Programs section which already uses the same badge pattern.

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/members/MemberDetailSheet.tsx` | Lines 233-267: add field-type color map, update dot class, replace text label with badge |

## Available Primitives

- No shared Badge component exists — all badges are hand-rolled Tailwind spans
- `class-variance-authority` is installed but unused
- `lucide-react` available for icons (optional enhancement)
- Existing badge pattern: `inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700`

## Risks

- `field` is typed as `string`, not a union — need safe fallback in color map for unknown values
- No existing frontend tests for MemberDetailSheet — recommend adding test for correct badge classes
- Color map must stay in sync with `_FINANCIAL_FIELDS` in backend
