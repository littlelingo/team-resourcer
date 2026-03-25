# Research: TanStack React Query DevTools (Dev Only)

## Goal
Add `@tanstack/react-query-devtools` to the frontend, visible only in non-production environments.

## Current State
- **QueryClientProvider** mounted in `frontend/src/main.tsx:13`, wrapping the entire app
- **QueryClient** configured in `frontend/src/lib/query-client.ts` with `staleTime: 60s`, `retry: 1`
- **`@tanstack/react-query-devtools`** is NOT installed
- No existing dev-only conditional patterns in the codebase

## Environment Detection
- Use `import.meta.env.DEV` (Vite built-in) — `true` during `vite dev`, `false` in production builds
- Do NOT use `process.env.NODE_ENV` — not exposed to the Vite browser bundle
- Vite tree-shakes the devtools import entirely from production builds when guarded by `import.meta.env.DEV`

## Integration Point
- **File**: `frontend/src/main.tsx`
- **Location**: Inside `QueryClientProvider`, as sibling of `<App />` and `<Toaster />`
- **Pattern**: `{import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}`

## Changes Required
1. `npm install --save-dev @tanstack/react-query-devtools`
2. Add conditional import + render in `main.tsx`

## Risks
- None — tree-shaken from prod builds, zero runtime cost in production
- Package version should match `@tanstack/react-query` major (both v5)
