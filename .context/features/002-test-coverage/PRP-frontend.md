---
feature: 002-test-coverage
phase: frontend
status: COMPLETE
testing: test-first
complexity: HIGH
---

# PRP: Frontend Test Coverage

## Status: COMPLETE
## Created: 2026-03-23
## Complexity: HIGH
## Testing Strategy: test-first — write test files as primary deliverable; no application code changes

---

## 1. Overview

The frontend has zero test infrastructure and zero test files. This PRP installs Vitest, Testing Library, and MSW; configures the test runner; then writes tests for all utility functions, data-fetching hooks, tree utility hooks, and four targeted components. The goal is 70%+ coverage on `src/lib/` and `src/hooks/` and verified correctness on the component interaction paths most likely to break during refactors.

---

## 2. Requirements

### Must Have
- [ ] Vitest + jsdom test runner configured in `vite.config.ts`
- [ ] `test` and `test:coverage` scripts in `package.json`
- [ ] Setup file importing `@testing-library/jest-dom` matchers
- [ ] Unit tests for `getInitials` covering all edge cases
- [ ] Unit tests for `apiFetch` and `getImageUrl` covering documented behaviors
- [ ] MSW v2 server setup with handlers for all hook API paths
- [ ] Hook tests for `useMembers`, `usePrograms`, `useTrees`
- [ ] Tree utility tests for `layoutTree`, `useTreeSearch`, and `useDragReassign` internal logic
- [ ] Component tests for `ConfirmDialog`, `DataTable`, `MemberCard`, `MapColumnsStep`
- [ ] All tests pass: `npm run test`
- [ ] Coverage at or above 70% on `src/lib/` and `src/hooks/`: `npm run test:coverage`

### Nice to Have
- [ ] MSW handlers also cover `useTeams` paths for future hook test expansion

### Out of Scope
- Page-level tests (`src/pages/`)
- `ImportWizard.tsx` step-transition tests (high complexity, separate PRP)
- Form dialog tests (`MemberFormDialog`, `TeamFormDialog`, etc.)
- Backend test coverage (separate PRP)

---

## 3. Technical Approach

**Architecture Impact**: Zero changes to application code. All new files are test infrastructure and test files. The `vite.config.ts` gains a `test` block (Vitest reads this at runtime; the build pipeline ignores the key).

**Key Decisions**:
- **MSW v2 HTTP handlers** (not `rest`, use `http` from `msw/http`) for hook tests. MSW v2 changed the import path and handler API — `http.get(url, resolver)` where resolver receives `({ request, params, cookies })` and returns `HttpResponse.json(data)`.
- **`renderHook` + `QueryClientProvider`** wrapper for all TanStack Query hook tests. Vitest globals (`describe`, `it`, `expect`, `beforeAll`, `afterEach`, `afterAll`) are available without imports because `globals: true` is set in the Vitest config.
- **`layoutTree` is a pure exported function** (not just the hook); test it directly without React rendering to avoid `useMemo` complexity.
- **`useDragReassign` internal helpers** (`isValidTarget`, `getNodeCenter`, `getDistance`) are not exported. Test their behavior indirectly via `handleNodeDragStop` and `confirmReassign` — both are returned from the hook.
- **`VITE_API_BASE_URL` env var** is read at module load time in `api-client.ts` via `import.meta.env`. Set it in the Vitest config via `test.env` so the module resolves to a known value (`http://localhost:8000`) during tests.
- **`@testing-library/user-event` v14** uses `userEvent.setup()` before rendering, not the legacy `userEvent.click()` directly.
- **Radix UI `AlertDialog`** renders into a Portal. Testing Library's `screen` queries work correctly with portals in jsdom; no special setup needed.

**File Manifest**:

| File | Action | Description |
|------|--------|-------------|
| `frontend/package.json` | MODIFY | Add `test` and `test:coverage` scripts; add 7 devDependencies |
| `frontend/vite.config.ts` | MODIFY | Add `test` block with globals, jsdom environment, setupFiles, env, and coverage config |
| `frontend/src/test/setup.ts` | CREATE | Import `@testing-library/jest-dom` to register matchers |
| `frontend/src/test/msw/server.ts` | CREATE | MSW `setupServer(...)` export for use in test files |
| `frontend/src/test/msw/handlers.ts` | CREATE | MSW v2 HTTP handlers for all tested API endpoints |
| `frontend/src/lib/__tests__/member-utils.test.ts` | CREATE | Unit tests for `getInitials` |
| `frontend/src/lib/__tests__/api-client.test.ts` | CREATE | Unit tests for `apiFetch` and `getImageUrl` |
| `frontend/src/hooks/__tests__/useMembers.test.ts` | CREATE | Hook tests for all five member hooks |
| `frontend/src/hooks/__tests__/usePrograms.test.ts` | CREATE | Hook tests for all six program hooks |
| `frontend/src/hooks/__tests__/useTrees.test.ts` | CREATE | Hook tests for `useOrgTree`, `useProgramTree`, `useAreaTree` |
| `frontend/src/components/trees/__tests__/useTreeLayout.test.ts` | CREATE | Tests for exported `layoutTree` function |
| `frontend/src/components/trees/__tests__/useTreeSearch.test.ts` | CREATE | Tests for `useTreeSearch` hook |
| `frontend/src/components/trees/__tests__/useDragReassign.test.ts` | CREATE | Tests for `useDragReassign` hook behaviors |
| `frontend/src/components/shared/__tests__/ConfirmDialog.test.tsx` | CREATE | Component tests for ConfirmDialog |
| `frontend/src/components/shared/__tests__/DataTable.test.tsx` | CREATE | Component tests for DataTable |
| `frontend/src/components/members/__tests__/MemberCard.test.tsx` | CREATE | Component tests for MemberCard |
| `frontend/src/components/import/__tests__/MapColumnsStep.test.tsx` | CREATE | Component tests for MapColumnsStep |

---

## 4. Implementation Steps

### Step 1 — Install dependencies and configure the test runner

**File: `frontend/package.json`**

Add to `devDependencies`:
```
"vitest": "^2.x",
"@vitest/coverage-v8": "^2.x",
"@testing-library/react": "^16.x",
"@testing-library/user-event": "^14.x",
"@testing-library/jest-dom": "^6.x",
"jsdom": "^25.x",
"msw": "^2.x"
```

Add to `scripts`:
```
"test": "vitest run",
"test:coverage": "vitest run --coverage"
```

Run: `npm install` from `frontend/` to materialize `node_modules` entries.

- [ ] **Modify** `frontend/package.json` — add scripts and devDependencies as above
- [ ] **Run** `cd frontend && npm install` to install

---

**File: `frontend/vite.config.ts`**

Add a `test` property to the `defineConfig` object. The existing `plugins` and `resolve.alias` must remain unchanged. The final shape:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    env: {
      VITE_API_BASE_URL: 'http://localhost:8000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**', 'src/hooks/**'],
      thresholds: {
        lines: 70,
        functions: 70,
      },
    },
  },
})
```

- [ ] **Modify** `frontend/vite.config.ts` — add `test` block exactly as specified above

---

**File: `frontend/src/test/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

Single line. This registers the extended matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.) globally for all test files.

- [ ] **Create** `frontend/src/test/setup.ts`

**Verify Step 1**: Run `cd frontend && npm run test` — Vitest should find no test files but exit 0 with "no tests found" output. If it errors on configuration, fix before proceeding.

---

### Step 2 — MSW server and handlers

**File: `frontend/src/test/msw/handlers.ts`**

Use MSW v2 API. Import `http` from `'msw'` and `HttpResponse` from `'msw'`. All handlers match paths prefixed with `http://localhost:8000` (the value set in `test.env.VITE_API_BASE_URL`).

Define handlers for these endpoints:

| Handler | Method | Path | Default response shape |
|---------|--------|------|------------------------|
| `membersListHandler` | GET | `/api/members/` | `[{ uuid: 'uuid-1', name: 'Alice Example', employee_id: 'E001', title: 'Engineer', image_path: null, location: null, email: null }]` |
| `memberDetailHandler` | GET | `/api/members/:uuid` | `{ uuid: 'uuid-1', name: 'Alice Example', employee_id: 'E001', title: 'Engineer', image_path: null }` |
| `memberCreateHandler` | POST | `/api/members/` | status 201, body `{ uuid: 'uuid-new', name: 'Bob New', employee_id: 'E002' }` |
| `memberUpdateHandler` | PUT | `/api/members/:uuid` | `{ uuid: 'uuid-1', name: 'Alice Updated' }` |
| `memberDeleteHandler` | DELETE | `/api/members/:uuid` | status 204, no body |
| `programsListHandler` | GET | `/api/programs/` | `[{ id: 1, name: 'Alpha Program' }]` |
| `programDetailHandler` | GET | `/api/programs/:id` | `{ id: 1, name: 'Alpha Program' }` |
| `programMembersHandler` | GET | `/api/programs/:id/members` | `[]` |
| `programCreateHandler` | POST | `/api/programs/` | status 201, body `{ id: 2, name: 'Beta Program' }` |
| `programUpdateHandler` | PUT | `/api/programs/:id` | `{ id: 1, name: 'Alpha Updated' }` |
| `programDeleteHandler` | DELETE | `/api/programs/:id` | status 204, no body |
| `orgTreeHandler` | GET | `/api/org/tree` | `{ nodes: [], edges: [] }` |
| `programTreeHandler` | GET | `/api/programs/:id/tree` | `{ nodes: [], edges: [] }` |
| `areaTreeHandler` | GET | `/api/areas/:id/tree` | `{ nodes: [], edges: [] }` |
| `orgSupervisorHandler` | PUT | `/api/org/members/:uuid/supervisor` | `{ uuid: 'uuid-1' }` |
| `programAssignHandler` | POST | `/api/programs/:id/assignments` | status 201, body `{}` |
| `programUnassignHandler` | DELETE | `/api/programs/:id/assignments/:uuid` | status 204, no body |
| `memberPatchHandler` | PUT | `/api/members/:uuid` | (same as memberUpdateHandler — register separately so useDragReassign area-type can be tested) |
| `importPreviewHandler` | POST | `/api/import/preview` | `{ rows: [], error_count: 0, warning_count: 0 }` |

Export the array as `handlers` (default export or named — consistent with what `server.ts` imports).

- [ ] **Create** `frontend/src/test/msw/handlers.ts`

---

**File: `frontend/src/test/msw/server.ts`**

```ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

- [ ] **Create** `frontend/src/test/msw/server.ts`

**Verify Step 2**: TypeScript-check `frontend/src/test/msw/server.ts` — the `msw/node` import must resolve cleanly. If TypeScript errors appear on `http` or `HttpResponse` imports, check that `msw@^2.x` is installed (MSW v1 had a different import shape).

---

### Step 3 — Unit tests for pure utility functions

**File: `frontend/src/lib/__tests__/member-utils.test.ts`**

Tests for `getInitials` from `@/lib/member-utils`:

| Test name | Input | Expected output |
|-----------|-------|-----------------|
| `single word returns first two chars uppercased` | `'alice'` | `'AL'` |
| `single char returns that char uppercased` | `'a'` | `'A'` |
| `two words returns first letter of each word` | `'Alice Example'` | `'AE'` |
| `three words returns first and last initial` | `'Alice Marie Example'` | `'AE'` |
| `extra whitespace is trimmed and collapsed` | `'  Alice   Example  '` | `'AE'` |
| `all caps input preserved` | `'ALICE EXAMPLE'` | `'AE'` |
| `unicode names` | `'Ångström Björk'` | `'ÅB'` (toUpperCase of first letters) |

- [ ] **Create** `frontend/src/lib/__tests__/member-utils.test.ts` with all 7 tests

---

**File: `frontend/src/lib/__tests__/api-client.test.ts`**

`apiFetch` and `getImageUrl` are tested by controlling the global `fetch` via `vi.stubGlobal('fetch', ...)` (not MSW — these are pure unit tests of the wrapper function itself, not hook behavior).

Test cases for `apiFetch`:

| Test name | Setup | Expected behavior |
|-----------|-------|-------------------|
| `sets Content-Type: application/json for JSON bodies` | stub fetch returning `{ ok: true, status: 200, json: async () => ({}) }` | fetch called with `headers['Content-Type'] === 'application/json'` |
| `omits Content-Type when body is FormData` | stub fetch returning 200 ok; pass `body: new FormData()` | fetch called without `Content-Type` header |
| `returns undefined for 204 responses` | stub fetch returning `{ ok: true, status: 204 }` | resolved value is `undefined` |
| `throws with statusText on non-ok response with no JSON` | stub fetch returning `{ ok: false, status: 404, statusText: 'Not Found', json: async () => { throw new Error() } }` | throws `Error` with message `'Not Found'` |
| `throws with detail field from JSON error body` | stub fetch returning `{ ok: false, status: 422, statusText: 'Unprocessable Entity', json: async () => ({ detail: 'Validation error' }) }` | throws `Error` with message `'Validation error'` |
| `calls fetch with BASE_URL prepended to path` | stub fetch returning 200 ok with `json: async () => ({})` | fetch first arg starts with `'http://localhost:8000'` |

Test cases for `getImageUrl`:

| Test name | Input | Expected output |
|-----------|-------|-----------------|
| `returns undefined for null` | `null` | `undefined` |
| `returns undefined for undefined` | `undefined` | `undefined` |
| `returns undefined for empty string` | `''` | `undefined` |
| `prepends BASE_URL for relative path starting with /` | `'/media/abc.jpg'` | `'http://localhost:8000/media/abc.jpg'` |
| `returns absolute URL unchanged` | `'https://cdn.example.com/img.jpg'` | `'https://cdn.example.com/img.jpg'` |

Use `beforeEach(() => vi.unstubAllGlobals())` to clean up between tests.

- [ ] **Create** `frontend/src/lib/__tests__/api-client.test.ts` with all 11 tests

**Verify Step 3**: `npm run test -- src/lib` should pass all tests with no failures.

---

### Step 4 — Hook tests with MSW

All hook test files follow this structure:
1. Import `server` from `@/test/msw/server`
2. `beforeAll(() => server.listen())`
3. `afterEach(() => server.resetHandlers())`
4. `afterAll(() => server.close())`
5. Define a `createWrapper()` factory that returns a component wrapping `QueryClientProvider` with a fresh `QueryClient({ defaultOptions: { queries: { retry: false } } })` — `retry: false` prevents Vitest from timing out on expected error paths
6. Use `renderHook(() => hookUnderTest(), { wrapper: createWrapper() })`
7. Use `waitFor` from `@testing-library/react` to await async state

---

**File: `frontend/src/hooks/__tests__/useMembers.test.ts`**

Tests for hooks from `@/hooks/useMembers`:

| Test name | Hook | What to assert |
|-----------|------|----------------|
| `useMembers fetches list on mount` | `useMembers()` | after `waitFor`, `result.current.data` is array with `name === 'Alice Example'` |
| `useMembers passes query params in URL` | `useMembers({ title: 'Engineer' })` | use `server.use(http.get(...))` override that captures the request URL; assert `new URL(request.url).searchParams.get('title') === 'Engineer'` |
| `useMember fetches detail by uuid` | `useMember('uuid-1')` | after `waitFor`, `result.current.data.uuid === 'uuid-1'` |
| `useMember is disabled when uuid is empty string` | `useMember('')` | `result.current.fetchStatus === 'idle'` immediately (no fetch triggered) |
| `useCreateMember POSTs and invalidates members list` | `useCreateMember()` — call `result.current.mutate({ name: 'Bob', employee_id: 'E002', ... })` | after `waitFor`, `result.current.isSuccess === true` |
| `useUpdateMember PUTs and invalidates list and detail` | `useUpdateMember()` — call `result.current.mutate({ uuid: 'uuid-1', data: { name: 'Alice Updated' } })` | after `waitFor`, `result.current.isSuccess === true` |
| `useDeleteMember sends DELETE and invalidates list` | `useDeleteMember()` — call `result.current.mutate('uuid-1')` | after `waitFor`, `result.current.isSuccess === true` |

- [ ] **Create** `frontend/src/hooks/__tests__/useMembers.test.ts` with all 7 tests

---

**File: `frontend/src/hooks/__tests__/usePrograms.test.ts`**

| Test name | Hook | What to assert |
|-----------|------|----------------|
| `usePrograms fetches list on mount` | `usePrograms()` | `result.current.data[0].name === 'Alpha Program'` |
| `useProgram fetches detail by id` | `useProgram(1)` | `result.current.data.id === 1` |
| `useProgram disabled when id is 0` | `useProgram(0)` | `result.current.fetchStatus === 'idle'` |
| `useProgramMembers disabled when id is 0` | `useProgramMembers(0)` | `result.current.fetchStatus === 'idle'` |
| `useProgramMembers fetches members for id` | `useProgramMembers(1)` | `result.current.data` is an array (may be empty) |
| `useCreateProgram POSTs successfully` | `useCreateProgram()` — mutate `{ name: 'Beta Program' }` | `result.current.isSuccess === true` |
| `useUpdateProgram PUTs successfully` | `useUpdateProgram()` — mutate `{ id: 1, data: { name: 'Alpha Updated' } }` | `result.current.isSuccess === true` |
| `useDeleteProgram sends DELETE` | `useDeleteProgram()` — mutate `1` | `result.current.isSuccess === true` |

- [ ] **Create** `frontend/src/hooks/__tests__/usePrograms.test.ts` with all 8 tests

---

**File: `frontend/src/hooks/__tests__/useTrees.test.ts`**

| Test name | Hook | What to assert |
|-----------|------|----------------|
| `useOrgTree fetches /api/org/tree` | `useOrgTree()` | `result.current.data` has `nodes` and `edges` properties |
| `useProgramTree fetches /api/programs/:id/tree` | `useProgramTree(1)` | `result.current.data.nodes` is an array |
| `useProgramTree is disabled when id is 0` | `useProgramTree(0)` | `result.current.fetchStatus === 'idle'` |
| `useProgramTree is disabled when id is -1` | `useProgramTree(-1)` | `result.current.fetchStatus === 'idle'` |
| `useAreaTree fetches /api/areas/:id/tree` | `useAreaTree(1)` | `result.current.data.nodes` is an array |
| `useAreaTree is disabled when id is 0` | `useAreaTree(0)` | `result.current.fetchStatus === 'idle'` |

- [ ] **Create** `frontend/src/hooks/__tests__/useTrees.test.ts` with all 6 tests

**Verify Step 4**: `npm run test -- src/hooks` should pass all 21 tests.

---

### Step 5 — Tree utility hook/function tests

**File: `frontend/src/components/trees/__tests__/useTreeLayout.test.ts`**

Test the exported `layoutTree` function directly (no React rendering needed). Import `layoutTree` from `@/components/trees/useTreeLayout`.

Build a minimal `TreeNode` shape: `{ id: string; position: { x: number; y: number }; data: Record<string, unknown>; type?: string }`. Build a minimal `TreeEdge` shape: `{ id: string; source: string; target: string }`.

| Test name | Setup | Expected behavior |
|-----------|-------|-------------------|
| `returns empty array for empty input` | `layoutTree([], [], 'TB')` | returns `[]` |
| `returns same node count as input` | 3 nodes, 2 edges (linear chain), `'TB'` | returned array has length 3 |
| `assigns numeric x and y positions to all nodes` | 3 nodes, 2 edges | every node in result has `position.x` as a finite number and `position.y` as a finite number |
| `TB layout places root node at lower y than children` | root node + one child connected by edge | root `position.y` is less than child `position.y` (dagre top-to-bottom places parent above child) |
| `LR layout places root node at lower x than children` | root node + one child connected by edge | root `position.x` is less than child `position.x` |
| `ignores edges whose source or target are not in node list` | 2 nodes, 1 edge referencing a missing node id | does not throw; returns 2 nodes with positions |
| `applies NODE_WIDTH/2 offset to x` | single node | `position.x` equals `dagre-center-x - 110` (i.e., `g.node(...).x - 220/2`) |

- [ ] **Create** `frontend/src/components/trees/__tests__/useTreeLayout.test.ts` with all 7 tests

---

**File: `frontend/src/components/trees/__tests__/useTreeSearch.test.ts`**

`useTreeSearch` is a hook wrapping `useMemo`, so use `renderHook` from `@testing-library/react`. Import from `@/components/trees/useTreeSearch`.

Build minimal `Node` objects from `@xyflow/react` using `{ id: string; data: { name: string }; position: { x: 0, y: 0 } }`.

| Test name | Nodes input | Query | Expected output |
|-----------|-------------|-------|-----------------|
| `empty query returns all nodes unchanged` | `[{ id: '1', data: { name: 'Alice' } }]` | `''` | returned node has no `opacity` in style |
| `whitespace-only query returns all nodes unchanged` | same | `'   '` | returned node has no `opacity` override |
| `matching node has no opacity override` | Alice, Bob nodes | `'alice'` | Alice node has no `opacity` in style; Bob node has `opacity: 0.2` |
| `non-matching node gets opacity 0.2` | Alice, Bob nodes | `'bob'` | Bob node has no `opacity`; Alice node has `opacity: 0.2` |
| `search is case-insensitive` | `[{ id: '1', data: { name: 'Alice' } }]` | `'ALICE'` | node has no `opacity` override (matched) |
| `partial match works` | `[{ id: '1', data: { name: 'Alice Example' } }]` | `'exam'` | node has no `opacity` override |
| `node with no data.name never matches` | `[{ id: '1', data: {} }]` | `'alice'` | node has `opacity: 0.2` |
| `previously-dimmed node has opacity removed when query clears` | node with `style: { opacity: 0.2, color: 'red' }` | `''` | returned style has `color: 'red'` but no `opacity` property |

- [ ] **Create** `frontend/src/components/trees/__tests__/useTreeSearch.test.ts` with all 8 tests

---

**File: `frontend/src/components/trees/__tests__/useDragReassign.test.ts`**

`useDragReassign` requires MSW for the `confirmReassign` path. Set up the MSW server as in Step 4.

Import `useDragReassign` from `@/components/trees/useDragReassign`. Use `renderHook`. The hook signature is `useDragReassign(treeType, onSuccess)`.

Build minimal `Node` objects with: `{ id: string; type: string; position: { x: number; y: number }; measured: { width: 220; height: 90 }; data: { uuid?: string; id?: number } }`.

`handleNodeDragStop` signature: `(event, draggedNode, allNodes)` — pass `null as unknown as React.MouseEvent` for the event arg.

**Tests for `handleNodeDragStop` snapping behavior:**

| Test name | Setup | Expected state |
|-----------|-------|----------------|
| `sets pendingReassign when valid target within SNAP_DISTANCE` | org tree; dragged member node at `{0,0}`; target member node at `{40, 0}` (distance = 40, below SNAP_DISTANCE=60); `measured: {width:220, height:90}` — centers are at `{110,45}` and `{150,45}`, distance = 40 | `result.current.pendingReassign` is not null after drag stop |
| `does not set pendingReassign when target is too far` | drag distance = 200 (centers > 60 apart) | `result.current.pendingReassign` is null; `onSuccess` was called |
| `does not set pendingReassign for invalid target type in org tree` | org tree; target node has `type: 'team'` (not `'member'`) | `result.current.pendingReassign` is null |
| `valid target in program tree requires type program` | program tree; target node has `type: 'program'`; within snap distance | `pendingReassign` is not null |
| `invalid target in program tree (type member)` | program tree; target node has `type: 'member'` | `pendingReassign` is null |
| `valid target in area tree accepts type team` | area tree; target `type: 'team'`; within snap distance | `pendingReassign` is not null |
| `valid target in area tree accepts type area` | area tree; target `type: 'area'`; within snap distance | `pendingReassign` is not null |

**Tests for `confirmReassign`:**

| Test name | Tree type | Setup | Expected |
|-----------|-----------|-------|----------|
| `org: calls PUT /api/org/members/:uuid/supervisor` | `'org'` | set `pendingReassign` by calling `handleNodeDragStop` first; MSW handler for `orgSupervisorHandler` returns 200 | after `waitFor`, `onSuccess` was called (use `vi.fn()`); `pendingReassign` is null |
| `area: calls PUT /api/members/:uuid with team_id` | `'area'` | dragged node `data.uuid = 'uuid-1'`; target node `type: 'team'`, `data.id = 5` | MSW captures PUT body; after confirm, `onSuccess` called |
| `area: sets team_id to null when target is area node` | `'area'` | target node `type: 'area'` | MSW receives `team_id: null` in PUT body |
| `cancelReassign clears pendingReassign without calling onSuccess` | any tree | set pending via drag; call `cancelReassign()` | `pendingReassign` is null; `onSuccess` not called |
| `confirmReassign is a no-op when pendingReassign is null` | any tree | call `confirmReassign()` without prior drag stop | no MSW request made; no error thrown |

Note: The `program` tree type `confirmReassign` path involves edge lookup via `setEdges`/`edgesRef`. For the program test, call `result.current.setEdges([{ id: 'e1', source: 'program-3', target: draggedNode.id }])` before confirming, so the old-assignment DELETE path fires.

- [ ] **Create** `frontend/src/components/trees/__tests__/useDragReassign.test.ts` with all 12 tests

**Verify Step 5**: `npm run test -- src/components/trees` should pass all 27 tests.

---

### Step 6 — Component tests

**File: `frontend/src/components/shared/__tests__/ConfirmDialog.test.tsx`**

Import `ConfirmDialog` (default export) from `@/components/shared/ConfirmDialog`. Use `render` from `@testing-library/react` and `userEvent.setup()`.

| Test name | Props | Action | Assertion |
|-----------|-------|--------|-----------|
| `renders title and description when open` | `open: true`, `title: 'Delete Item'`, `description: 'This cannot be undone.'` | — | `screen.getByText('Delete Item')` and `screen.getByText('This cannot be undone.')` are in the document |
| `does not render content when closed` | `open: false` | — | `screen.queryByText('Delete Item')` is null |
| `calls onConfirm when Confirm button clicked` | `open: true`, `onConfirm: vi.fn()` | click button with text `'Confirm'` | `onConfirm` called once |
| `calls onOpenChange(false) when Cancel clicked` | `open: true`, `onOpenChange: vi.fn()` | click button with text `'Cancel'` | `onOpenChange` called with `false` |
| `Confirm and Cancel buttons are disabled when loading=true` | `open: true`, `loading: true` | — | both buttons have `disabled` attribute |
| `shows spinner icon when loading=true` | `open: true`, `loading: true` | — | `document.querySelector('.animate-spin')` is not null |

- [ ] **Create** `frontend/src/components/shared/__tests__/ConfirmDialog.test.tsx` with all 6 tests

---

**File: `frontend/src/components/shared/__tests__/DataTable.test.tsx`**

Import `DataTable` from `@/components/shared/DataTable`. Define a minimal column definition using `ColumnDef<{ name: string }, string>` from `@tanstack/react-table`.

```ts
const columns: ColumnDef<{ name: string }, string>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: (info) => info.getValue(),
  },
]
```

| Test name | Props | Assertion |
|-----------|-------|-----------|
| `renders column header` | `columns`, `data: []` | `screen.getByText('Name')` is in document |
| `renders row data` | `data: [{ name: 'Alice' }, { name: 'Bob' }]` | `screen.getByText('Alice')` and `screen.getByText('Bob')` are in document |
| `shows empty message when data is empty` | `data: []`, `emptyMessage: 'No members found.'` | `screen.getByText('No members found.')` is in document |
| `shows default empty message when emptyMessage not provided` | `data: []` | `screen.getByText('No results found.')` is in document |
| `shows skeleton rows when loading=true` | `loading: true`, `data: []` | 5 skeleton rows rendered — query `document.querySelectorAll('.animate-pulse')` has length 5 |
| `does not show empty message when loading` | `loading: true`, `data: []` | `screen.queryByText('No results found.')` is null |

- [ ] **Create** `frontend/src/components/shared/__tests__/DataTable.test.tsx` with all 6 tests

---

**File: `frontend/src/components/members/__tests__/MemberCard.test.tsx`**

Import `MemberCard` (default export) from `@/components/members/MemberCard`. Use `userEvent.setup()`.

The `member` prop type is `TeamMemberList & { functional_area?: ...; program_assignments?: ... }`. Minimal valid member:

```ts
const baseMember = {
  uuid: 'uuid-1',
  name: 'Alice Example',
  employee_id: 'E001',
  title: 'Engineer',
  image_path: null,
  location: null,
  email: null,
}
```

| Test name | Setup | Action | Assertion |
|-----------|-------|--------|-----------|
| `renders member name` | baseMember | — | `screen.getByText('Alice Example')` in document |
| `renders title when present` | `title: 'Engineer'` | — | `screen.getByText('Engineer')` in document |
| `renders location with pin icon when present` | `location: 'Remote'` | — | `screen.getByText('Remote')` in document |
| `renders functional area badge` | `functional_area: { id: 1, name: 'Engineering', description: null }` | — | `screen.getByText('Engineering')` in document |
| `renders program assignment badges` | `program_assignments: [{ program: { id: 1, name: 'Alpha' }, role: null }]` | — | `screen.getByText('Alpha')` in document |
| `shows initials fallback when no image_path` | baseMember with `image_path: null` | — | `screen.getByText('AE')` in document (Avatar.Fallback) |
| `calls onClick when card body clicked` | `onClick: vi.fn()` | click the outermost `div` (role not set; use `container.firstChild`) | `onClick` called once |
| `calls onEdit when Edit menu item selected` | `onEdit: vi.fn()` | click kebab button (`aria-label="Member actions"`), then click `'Edit'` item | `onEdit` called with the member object |
| `calls onDelete when Delete menu item selected` | `onDelete: vi.fn()` | click kebab button, click `'Delete'` item | `onDelete` called with the member object |
| `card click does not fire when kebab menu is clicked` | `onClick: vi.fn()` | click the kebab button only | `onClick` not called (stopPropagation test) |

Note: Radix `DropdownMenu` renders into a Portal. After clicking the trigger, use `await screen.findByText('Edit')` (async) to wait for the Portal content to appear in the DOM before clicking.

- [ ] **Create** `frontend/src/components/members/__tests__/MemberCard.test.tsx` with all 10 tests

---

**File: `frontend/src/components/import/__tests__/MapColumnsStep.test.tsx`**

Import `MapColumnsStep` (default export) from `@/components/import/MapColumnsStep`. This component calls `previewMapping` via `useMutation`. Set up the MSW server (Step 2) in `beforeAll`/`afterEach`/`afterAll`. Wrap renders in `QueryClientProvider`.

The component props:
```ts
interface MapColumnsStepProps {
  sessionId: string
  headers: string[]
  initialColumnMap: Record<string, string | null>
  onPreview: (columnMap: Record<string, string | null>, result: MappedPreviewResult) => void
}
```

| Test name | Props | Action | Assertion |
|-----------|-------|--------|-----------|
| `renders a row for each header` | `headers: ['Full Name', 'Employee ID', 'Location']`, `initialColumnMap: {}` | — | three `<select>` elements in document |
| `auto-suggests employee_id for Employee ID header` | `headers: ['Employee ID']`, `initialColumnMap: {}` | — | the select for `'Employee ID'` has `value === 'employee_id'` (use `getByDisplayValue` or `container.querySelector('select').value`) |
| `auto-suggests name for Full Name header` | `headers: ['Full Name']`, `initialColumnMap: {}` | — | select value is `'name'` |
| `uses initialColumnMap over auto-suggest when provided` | `headers: ['Employee ID']`, `initialColumnMap: { 'Employee ID': 'title' }` | — | select value is `'title'` |
| `Preview button disabled when employee_id not mapped` | `headers: ['Full Name']`, `initialColumnMap: {}` (only name mapped, not employee_id) | — | button with text `'Preview'` has `disabled` attribute |
| `Preview button disabled when name not mapped` | `headers: ['Employee ID']`, `initialColumnMap: {}` (only employee_id mapped) | — | `'Preview'` button is disabled |
| `Preview button enabled when both required fields mapped` | `headers: ['Full Name', 'Employee ID']`, `initialColumnMap: {}` | — | `'Preview'` button does not have `disabled` attribute |
| `shows warning text when required fields missing` | required fields not mapped | — | text matching `'Employee ID'` and `'Name'` visible in the warning paragraph |
| `calls onPreview with columnMap and result on successful preview` | both required fields mapped; MSW returns `{ rows: [], error_count: 0, warning_count: 0 }` | click `'Preview'` button | after `waitFor`, `onPreview` called with first arg matching the column map and second arg matching the MSW response |
| `shows error message on preview failure` | override MSW to return 422 with `{ detail: 'Session not found' }` | click `'Preview'` button | after `waitFor`, `screen.getByText('Session not found')` in document |
| `user can change a select value and new value is used in preview call` | `headers: ['Location']`, `initialColumnMap: {}` (auto-maps to `location`) | change select to `''` (Skip); click Preview (will be disabled — instead test that `hasRequiredFields` warning appears when both required mappings absent) | warning text visible |

- [ ] **Create** `frontend/src/components/import/__tests__/MapColumnsStep.test.tsx` with all 11 tests

**Verify Step 6**: `npm run test -- src/components/shared src/components/members src/components/import` should pass all 33 component tests.

---

### Step 7 — Final verification

- [ ] Run `cd frontend && npm run test` — all test files execute, zero failures
- [ ] Run `cd frontend && npm run test:coverage` — coverage report shows `src/lib/` and `src/hooks/` at or above 70% on lines and functions
- [ ] Run `cd frontend && npm run lint` — no new ESLint errors introduced by test files (test files import types that ESLint will check)
- [ ] Confirm no application source files were modified (`git diff --name-only` should show only the new files listed in the File Manifest above, plus the two modified config files)

---

## 5. Validation Checklist

- [ ] Tests pass: `cd frontend && npm run test`
- [ ] Coverage passes thresholds: `cd frontend && npm run test:coverage`
- [ ] Lint clean: `cd frontend && npm run lint`
- [ ] Type check: `cd frontend && npx tsc --noEmit`
- [ ] Manual: confirm MSW intercepts are not leaking between test suites (each file calls `server.resetHandlers()` in `afterEach`)

---

## 6. Risks

| Risk | Mitigation |
|------|------------|
| MSW v2 import shape differs from v1 — `http` not `rest`, `HttpResponse` not `res(ctx.json(...))` | All handler examples in this PRP use v2 API. If `msw@^2.x` is installed, the v2 shape is correct. Do not use any v1 examples from older documentation. |
| `import.meta.env` not available in Vitest without config | Set `test.env.VITE_API_BASE_URL` in `vite.config.ts` as specified in Step 1. Vitest replaces `import.meta.env` keys at compile time when the `test.env` block is present. |
| TanStack Query v5 `renderHook` wrapper — stale cache between tests | Use a fresh `QueryClient` instance per test by calling `createWrapper()` inside each `it()` block, not in `beforeEach`. Or use `queryClient.clear()` in `afterEach`. |
| Radix UI Portal components (`AlertDialog`, `DropdownMenu`) render outside the default container | Testing Library's `screen` queries search the entire `document.body`, which includes portal roots. No special setup required in jsdom, but `findBy*` (async) queries are needed after trigger clicks because Radix animates portal entry. |
| `@testing-library/jest-dom` types not recognized by TypeScript | The `tsconfig.app.json` has `"types": ["vite/client"]` which overrides automatic type discovery. Add `"@testing-library/jest-dom"` to the types array, or create `frontend/src/test/jest-dom.d.ts` with `import '@testing-library/jest-dom'` to force type augmentation. |
| `noUnusedLocals` / `noUnusedParameters` TypeScript strictness | Test files must not declare unused variables. Import only what is used in each test file. |
| Vite 8.x + Vitest 2.x compatibility | Both are on major versions released in 2024. The `@vitejs/plugin-react` v6 in `devDependencies` is compatible. Vitest 2.x reads the `test` block from `vite.config.ts` natively — no separate `vitest.config.ts` needed. |
| `suggestField` is not exported from `MapColumnsStep.tsx` | Test its behavior indirectly via the component: render with a known header and assert the select's initial value matches the expected auto-suggestion. |

---

## 7. Metrics

- **Plan date**: 2026-03-23
- **Validate date**: 2026-03-24
- **Elapsed**: 1 day
- **Steps**: 7 (all complete)
- **Strategy**: test-first (test files are the deliverable)
- **Test files**: 15 (18 created, 15 test suites)
- **Tests**: 111 passed, 0 failed
- **Coverage**: 100% lines, 100% functions on src/lib/ + src/hooks/
- **Errors during implementation**: 2 (MapColumnsStep duplicate text, coverage threshold gap — both fixed same session)
- **Knowledge entries added**: 4 (MSW v2 setup, TanStack Query testing, duplicate text matching, coverage scope)
- **Execution mode**: Agent team (4 parallel implementers + 1 coordinator)
