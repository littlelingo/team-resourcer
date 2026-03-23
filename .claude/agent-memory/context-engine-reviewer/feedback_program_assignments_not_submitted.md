---
name: Program Assignments Not Submitted in MemberFormDialog
description: The programs field array in MemberFormDialog is collected in form state but never sent to the API
type: feedback
---

`MemberFormDialog` has a full `useFieldArray` for program assignments (add/remove rows, select program + role). However, the `onSubmit` handler builds the `createMember`/`updateMember` payloads from `MemberFormInput` which has no `programs` field. The `values.programs` array is silently discarded.

**Why:** `MemberFormInput` type does not include a programs field, and the backend member create/update endpoints do not accept program assignments inline — those are managed via separate `/api/programs/{id}/assignments` endpoints. But the UI gives the impression that saving the form will persist the assignments.

**How to apply:** Flag any form field that is collected in UI state but not included in the submitted payload. This is a data-loss UX bug even if not a runtime error.
