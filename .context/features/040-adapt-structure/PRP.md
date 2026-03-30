# PRP: Adapt Structure

## Goal
Split oversized files identified in `/adapt` audit.

## Steps

### Step 1: Split import_commit.py (HIGH — 494 lines)
- Extract `_commit_members` and `_commit_financial_history` into `import_commit_members.py`
- Keep shared helpers, simple entity handlers, and `commit_import` orchestrator in `import_commit.py`
- Use lazy import in `commit_import` to avoid circular dependency

### Step 2: Extract useMemberForm hook (MEDIUM — 471 lines)
- Extract schema, form setup, cascading select logic, and submit handler into `useMemberForm.ts`
- MemberFormDialog.tsx becomes mostly JSX with hook consumption

## Deferred (barely over threshold)
- `MembersPage.tsx` (350 lines) — already uses .helpers pattern
- `TeamFormDialog.tsx` (305 lines) — barely over

## Testing Strategy
implement-then-test — run existing test suite after changes.
