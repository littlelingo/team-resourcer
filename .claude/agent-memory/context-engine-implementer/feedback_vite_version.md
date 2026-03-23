---
name: vite_version_pinning
description: Pinned create-vite@5.4.11 does not exist on npm; use @latest
type: feedback
---

Use `npm create vite@latest` instead of a pinned version like `5.4.11` — that version does not exist on the npm registry and will fail with ETARGET.

**Why:** The PRP specifies `vite@5.4.11` but `create-vite` package versions do not always align with Vite release tags. `@latest` (resolved to 9.0.3 in March 2026) works reliably.

**How to apply:** Any time a PRP specifies a pinned `create-vite` version, try `@latest` first. Note the actual resolved version in the implementation report.
