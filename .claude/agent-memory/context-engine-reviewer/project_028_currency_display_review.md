---
name: Feature 028 — History Currency Display Review
description: Review findings for format-utils extraction and history timeline currency rendering (2026-03-28)
type: project
---

Feature 028 extracted `formatCurrency` / `formatNumber` from `MemberDetailSheet.tsx` into a shared `frontend/src/lib/format-utils.ts` and applied them to the history timeline's `entry.value` render.

**Why:** Raw decimal strings like "120000.00" were rendering unformatted in the history timeline.

**Key findings:**

- `formatCurrency` returns `null` for falsy input. Used directly as JSX children in the history timeline (`{formatCurrency(entry.value)}`). React renders `null` silently — no visible bug, but the Compensation section above guards with `{member.salary && ...}` while the history section does not. Safe due to `entry.value: string` being non-nullable, but the null return contract is inconsistent between the two call sites.
- `entry.value` is typed `string` (non-nullable in `MemberHistory`) so the null/undefined branches in the format functions are purely defensive — correct but unreachable in practice.
- `formatNumber("0.00")` → `"0"` → renders as "0 hrs" for pto_used. Intentional per PRP, but a zero value is not suppressed — it will appear in the timeline. Not a bug.
- Field-name hardcoding (`'salary'`, `'bonus'`, `'pto_used'`) matches `_FINANCIAL_FIELDS` in the backend. Any future backend field additions require a matching frontend branch.
- `"0.5"` and `"0.05"` parsed by `parseFloat` have floating-point edge cases in `toString()` (e.g. `0.1 + 0.2` → `"0.30000000000000004"`), but for the PTO values expected in practice this is benign.
- Tests cover all 7 PRP-required cases for both functions. No missing coverage.

**How to apply:** If `_FINANCIAL_FIELDS` in the backend grows new fields, flag the `entry.field ===` conditional in `MemberDetailSheet.tsx` line ~245 as needing a matching branch.
