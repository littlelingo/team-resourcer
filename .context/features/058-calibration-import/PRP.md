## Title: Calibration Import UI
## Status: IMPLEMENTED
## Complexity: LOW
## Testing Strategy: implement-then-test

---

## Context
The calibration data import pipeline (backend + frontend wizard) was fully built as part of feature 057. The `ImportWizard` already supports `entityType="calibration"`, with column mapping, preview, commit, ambiguity resolution, and cache invalidation all wired. The only missing piece was the import button and dialog on `CalibrationPage.tsx`.

## Implementation (Single Step)

### Modified: `frontend/src/pages/CalibrationPage.tsx`
1. Added imports: `Dialog` from `@radix-ui/react-dialog`, `Upload` from lucide-react, `ImportWizard`
2. Added `importOpen` state in `CalibrationPageInner`
3. Added Import button in page header (between CyclePicker and WidgetToggleMenu)
4. Added `Dialog.Root` wrapping `<ImportWizard entityType="calibration" />` after CompareDrawer

### Pattern: MembersPage.tsx:321-347
Same Dialog + ImportWizard pattern used by all other import entry points.

### Cache Invalidation
Already handled inside `PreviewStep.tsx:104` and `ResultStep.tsx:50` — no additional invalidation needed.

## Verification
- [x] Import button visible in calibration page header
- [x] All 162 frontend tests pass (18/18 test files)
- [x] No backend changes required
