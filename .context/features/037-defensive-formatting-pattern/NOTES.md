# Research: Defensive Formatting Pattern (`?? rawValue`)

## Pattern Description

The `formatCurrency(value) ?? value` idiom ensures that if a formatter returns `null` (bad/empty input), the raw value is shown instead of a blank spot in the UI. This is critical when the source value comes from untyped/EAV contexts (like `MemberHistory.value`) where the TypeScript types say "non-nullable" but runtime data might disagree.

## Audit Results

### Formatter Signatures (`frontend/src/lib/format-utils.ts`)

- `formatCurrency(value: string | null | undefined): string | null` — returns `null` on falsy input; passthrough on NaN; otherwise `"$120,000.00"`
- `formatNumber(value: string | null | undefined): string | null` — same contract; returns cleaned number string

Both return `null` (not empty string) on empty/null input. `null` in JSX renders nothing → blank spot.

### Where pattern IS used (correct)

| Location | Code | Status |
|----------|------|--------|
| `MemberDetailSheet.tsx:261-265` | `formatCurrency(entry.value) ?? entry.value` | Correct — history timeline |

### Where pattern is MISSING (should be added)

| Location | Current Code | Risk | Fix |
|----------|-------------|------|-----|
| `MemberDetailSheet.tsx:220` | `formatCurrency(member.salary)` bare | Low — NaN passthrough saves it, but intent unclear | Add `?? member.salary` |
| `MemberDetailSheet.tsx:226` | `formatCurrency(member.bonus)` bare | Low — same | Add `?? member.bonus` |
| `MemberDetailSheet.tsx:232` | `formatNumber(member.pto_used)` bare | Low — could render `" hrs"` with no number | Add `?? member.pto_used` |

### Related gap: `hire_date` raw ISO string

| Location | Current Code | Risk | Fix |
|----------|-------------|------|-----|
| `MemberDetailSheet.tsx:175` | `{member.hire_date}` — raw ISO string | Medium — shows `"2023-01-15"` to users | Add `toLocaleDateString()` or new `formatDate` util |

### Not applicable

- `PreviewStep.tsx:228` — import preview intentionally shows raw values

## Proposed Changes

### 1. Add `??` fallback to Compensation section (3 lines)

Harden the 3 bare formatter calls in the Compensation section to use `??` fallback. Self-documenting and consistent with the history timeline.

### 2. Format `hire_date` with `toLocaleDateString()`

Apply the same date formatting used in the history timeline (`new Date(date).toLocaleDateString()`) to the hire date display.

### 3. Document pattern in CODE_PATTERNS.md

Add a "Defensive Formatting" entry explaining the `??` fallback idiom, when to use it, and why.

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/members/MemberDetailSheet.tsx` | Add `??` fallback to 3 compensation lines + format hire_date |
| `.context/patterns/CODE_PATTERNS.md` | Add Defensive Formatting pattern entry |
