# PRP: Structure Adaptation

**Status**: COMPLETE
**Strategy**: implement-then-test

## Steps

### Step 1: Extract SelectField and Field from MemberFormDialog to shared/
- MemberFormDialog.tsx (491 lines) → extract SelectField (~55 lines) and Field (~23 lines) to shared/
- MemberFormDialog imports from shared instead

### Step 2: Extract helpers from MembersPage
- MembersPage.tsx (322 lines) → extract SkeletonCard and MemberDetailSheetWrapper
- Create MembersPage.helpers.tsx co-located file

### Step 3: Extract supervisor resolution from import_commit
- import_commit.py (313 lines) → extract supervisor resolution + cycle detection to import_supervisor.py

### Dismissed
- TeamFormDialog.tsx (305 lines) — marginal overage, uses different Select pattern (Radix directly), skip
