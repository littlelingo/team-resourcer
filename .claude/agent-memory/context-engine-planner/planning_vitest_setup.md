---
name: planning_vitest_setup
description: Vitest + MSW v2 + Testing Library configuration gotchas for this project
type: project
---

When adding frontend test infrastructure to this project:

1. `import.meta.env.VITE_API_BASE_URL` is read at module load time in `api-client.ts`. Set `test.env.VITE_API_BASE_URL` in the `vite.config.ts` test block — do NOT use a `.env.test` file approach, Vitest's `test.env` is simpler and more explicit.

2. MSW v2 uses `http` (not `rest`) and `HttpResponse` (not `res(ctx.json(...))`). Import from `'msw'` for handlers, `'msw/node'` for `setupServer`.

3. `tsconfig.app.json` has `"types": ["vite/client"]` which blocks automatic jest-dom type augmentation. Either add `"@testing-library/jest-dom"` to the types array or create a `src/test/jest-dom.d.ts` declaration file.

4. TanStack Query v5 hook tests need `retry: false` in the QueryClient options to prevent timeout hangs on error-path tests.

5. Radix UI Portal components (AlertDialog, DropdownMenu) work with Testing Library's `screen` in jsdom — portals render into `document.body`. Use `findBy*` (async) after trigger clicks because Radix animates portal entry.

**Why:** These are non-obvious gotchas discovered while writing the 002-test-coverage frontend PRP. Future test PRPs should reference these rather than re-deriving them.

**How to apply:** Copy the exact `vite.config.ts` test block shape from the 002-test-coverage PRP as the template for any future test setup work.
