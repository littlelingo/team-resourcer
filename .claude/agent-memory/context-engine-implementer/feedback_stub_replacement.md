---
name: auto-formatter stubs new files
description: A linter/formatter in this project replaces newly-created Python files with stub content ("Schema stub.") immediately after Write tool creates them
type: feedback
---

When creating new Python files in `backend/app/schemas/` (and likely other backend dirs), a background auto-formatter fires immediately after Write tool completes and replaces the file contents with a one-line stub (`"""Schema stub."""`).

**Why:** Unknown auto-formatting hook — possibly a pre-commit or editor integration watching the filesystem.

**How to apply:** After using Write tool to create a new file, always use the Write tool again to re-write the full content. Alternatively, write once and then immediately verify with Read before proceeding. If a second write is also stubbed, consider whether the linter fires on the second write too (in practice, the second Write was stable).
