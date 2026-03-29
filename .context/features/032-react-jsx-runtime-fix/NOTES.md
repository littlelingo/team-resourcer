# Feature 032: React JSX Runtime Fix

## Research Date: 2026-03-29

---

## Exact Error Message

```
ReferenceError: React is not defined
 ❯ src/components/shared/__tests__/DataTable.test.tsx:49:12
     47|   it('clicking sortable column header toggles sort indicator', async (…
     48|     const user = userEvent.setup()
     49|     render(<DataTable columns={columns} data={data} />)
       |            ^
```

The error fires at any JSX expression — `<Component />` — in the test file. The stack trace always points to the first JSX site in the failing test.

---

## Test Run Summary

- **4 test files fail**, **35 tests fail**, **95 pass** (130 total)
- All failures are in `.tsx` test files; all passing tests are in `.ts` files plus `.tsx` hook tests that have `import React from 'react'`

---

## Root Cause

**Split-brain between `tsconfig.app.json` and the Vitest runtime.**

`tsconfig.app.json` line 17 sets `"jsx": "react-jsx"` — the automatic JSX transform. Under this setting TypeScript compiles JSX without requiring `import React`. **However**, `tsconfig.app.json` line 30 explicitly excludes test directories:

```json
"exclude": ["src/**/__tests__"]
```

Vitest uses `vite.config.ts` (no separate `vitest.config.ts`), which configures the `@vitejs/plugin-react` plugin. That plugin defaults to the automatic JSX runtime for `.tsx` files it processes. **The actual failure is that Vitest is not transforming the `.tsx` test files through `@vitejs/plugin-react`** — or the plugin is not injecting the automatic runtime import — causing JSX to desugar to `React.createElement(...)` calls with no `React` in scope.

The concrete evidence:
- All 4 failing test files are `.tsx` and have **no** `import React from 'react'`
- All 5 passing hook test files (`.ts`) also pass because they use `renderHook`, not raw JSX
- The hook tests that render JSX wrappers (`QueryClientProvider`) DO have `import React from 'react'` at line 1 — and they pass

The `vite.config.ts` `test` block does not explicitly configure `jsx` or a `transformMode`. Vitest's `jsdom` environment processes `.tsx` via Vite's pipeline, but the absence of an explicit `react()` plugin JSX transform directive for the test environment means the classic `React.createElement` path is used without the automatic runtime injector.

**Immediate trigger:** The 4 failing test files were written assuming automatic JSX transform (no `import React`) but the test runtime does not inject it.

---

## All Affected Files (35 tests, 4 files)

| File | Tests | Failure mode |
|------|-------|--------------|
| `src/components/import/__tests__/MapColumnsStep.test.tsx` | 11 | `React is not defined` at every JSX render call |
| `src/components/shared/__tests__/DataTable.test.tsx` | 6 | same |
| `src/components/members/__tests__/MemberCard.test.tsx` | 12 | same |
| `src/components/shared/__tests__/ConfirmDialog.test.tsx` | 6 | same |

---

## Files That Pass (for contrast)

These `.ts` hook test files all have `import React from 'react'` at line 1 and pass:
- `src/hooks/__tests__/usePrograms.test.ts`
- `src/hooks/__tests__/useTrees.test.ts`
- `src/hooks/__tests__/useFunctionalAreas.test.ts`
- `src/hooks/__tests__/useTeams.test.ts`
- `src/hooks/__tests__/useMembers.test.ts`

Non-JSX `.ts` tests pass without any React import:
- `src/lib/__tests__/api-client.test.ts`
- `src/lib/__tests__/format-utils.test.ts`
- `src/lib/__tests__/member-utils.test.ts`
- `src/lib/__tests__/query-client.test.ts`
- `src/components/trees/__tests__/useTreeSearch.test.ts`
- `src/components/trees/__tests__/useTreeLayout.test.ts`
- `src/components/trees/__tests__/useDragReassign.test.ts`

---

## Recommended Fix Approaches

Two valid options. **Option A is preferred** as it is the correct long-term approach and avoids polluting test files.

### Option A — Fix Vitest config to use automatic JSX runtime (recommended)

Add an explicit `react` plugin configuration in `vite.config.ts` under the `test` block, or ensure the top-level `react()` plugin covers test transforms. The key is to tell Vitest's Vite pipeline to use `react-jsx` (automatic runtime):

```ts
// vite.config.ts — inside defineConfig({...})
plugins: [react()],  // already present — this SHOULD work if transform is applied
```

The more reliable fix is to add `@vitejs/plugin-react` with explicit `jsxRuntime: 'automatic'` so it is unambiguous, or add a Vitest-specific `react()` override in the `test` section. Alternatively, check if the `@vitejs/plugin-react` version in use supports automatic runtime by default (it does since v3).

The cleanest surgical fix is to add to `vite.config.ts`:

```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  // add this:
  environmentOptions: {},
},
```

...and ensure the plugin list is processed for tests. If the plugin is already applying the automatic transform for production but not tests, the fix may be as simple as moving `plugins: [react()]` to be explicitly inside the `test` configuration, or verifying the Vite version handles this correctly.

**Most reliable single-line fix** — add to `vite.config.ts` test block:

```ts
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
  // explicit jsx transform for test runner:
  // no extra config needed if @vitejs/plugin-react >= 3.x is present at top level
}
```

If that alone doesn't fix it, add a `setupFiles` entry or a Vitest-specific plugin config.

### Option B — Add `import React from 'react'` to the 4 failing test files

This is the workaround. Add `import React from 'react'` as the first line in each of the 4 files:
- `src/components/import/__tests__/MapColumnsStep.test.tsx`
- `src/components/shared/__tests__/DataTable.test.tsx`
- `src/components/members/__tests__/MemberCard.test.tsx`
- `src/components/shared/__tests__/ConfirmDialog.test.tsx`

This is consistent with how the passing hook tests are written. It is the **lower-risk** fix (no config changes) but it is treating the symptom rather than the cause, and it is inconsistent with `tsconfig.app.json`'s `react-jsx` setting.

---

## Config Locations

| File | Relevant Setting |
|------|-----------------|
| `frontend/tsconfig.app.json:17` | `"jsx": "react-jsx"` — automatic transform for app code |
| `frontend/tsconfig.app.json:30` | `"exclude": ["src/**/__tests__"]` — test files excluded from app tsconfig |
| `frontend/vite.config.ts:7` | `plugins: [react()]` — automatic runtime should apply |
| `frontend/vite.config.ts:20-36` | `test` block — no explicit jsx transform configuration |
| `frontend/src/test/setup.ts` | Only imports `@testing-library/jest-dom` — no React polyfill |

---

## Prior Art / Related Errors

No matching entry in `.context/errors/INDEX.md` at time of research. This should be added as ERR-048 once fixed.
