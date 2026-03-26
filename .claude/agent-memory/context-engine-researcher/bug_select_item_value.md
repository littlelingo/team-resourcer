---
name: Bug — Select.Item empty string value
description: SelectField shared component uses value="" on its "None" clear item, which Radix Select v2 rejects with an uncaught error
type: project
---

`SelectField` at `frontend/src/components/shared/SelectField.tsx` line 42 renders a "None" `Select.Item` with `value=""`. Radix `@radix-ui/react-select` v2.2.6 explicitly disallows empty-string values on `Select.Item` (it reserves `""` as the sentinel for "no selection / show placeholder").

**Why:** The error throws as an uncaught console error when any dropdown inside `MemberFormDialog` is first opened.

**How to apply:** Fix is one file — replace `value=""` with a sentinel constant `"__none__"` on the None item, and convert it back to `""` in `onValueChange`. `TeamFormDialog` already uses this exact pattern (`value="__none__"`) and works correctly.

Context: `.context/features/016-member-select-value-bug/NOTES.md`
