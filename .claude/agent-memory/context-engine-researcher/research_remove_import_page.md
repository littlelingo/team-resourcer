---
name: research_remove_import_page
description: 2026-03-28 findings on removing the standalone /import route and sidebar nav entry (feature 022)
type: project
---

## Summary

The standalone `/import` route (`ImportPage.tsx`) is a thin 14-line wrapper that renders
`<ImportWizard />` for members only. It predates the per-section import dialogs that now live
in every entity page.

**Why:** Every section (Members, Programs, Agencies, FunctionalAreas, Teams) has its own inline
import button + dialog. The nav-level Import entry is redundant and confusing — it only covers
members and ignores the financial history subtypes now in MembersPage's dropdown.

**How to apply:** Feature 022 removes exactly 3 things:
1. `frontend/src/pages/ImportPage.tsx` — delete entirely
2. `frontend/src/App.tsx` line 11 (import) + line 28 (route)
3. `frontend/src/components/layout/AppLayout.tsx` line 11 (nav entry) + line 2 `Upload` icon import

No backend changes. No test file deletions. Dead /import URL falls back to /members redirect.
