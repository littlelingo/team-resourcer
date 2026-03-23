---
feature: 001-team-resourcer-app
phase: 2 - Card View + Table View
status: COMPLETE
testing: implement-then-test
complexity: HIGH
depends_on: PRP-phase1
---

# PRP: Phase 2 — Card View + Table View

## Overview

Build the complete React frontend for team-resourcer: an app shell with sidebar navigation, a Members card view with slide-out detail panel, toggle-able table views for Members/Programs/Functional Areas/Teams, full CRUD dialogs for every entity, TanStack Query for server state, and URL-driven filters. The frontend lives at `frontend/` and communicates with the Phase 1 FastAPI backend at `http://localhost:8000`.

## Prerequisites

Phase 1 must be complete and the backend must be running (`docker compose up`). The frontend directory must already be scaffolded as a Vite + React + TypeScript project with shadcn/ui initialized and Tailwind configured. If it is not, run the scaffold step first (Step 1 below).

---

## Steps

### [x] Step 1 — Scaffold frontend (skip if already done in Phase 1)

**Directory**: `frontend/`

If `frontend/package.json` does not exist, run:

```
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

Initialize shadcn/ui **only if running in an interactive terminal** (local dev). Select "New York" style, CSS variables: yes, base color: Slate:

```
cd frontend
npx shadcn@latest init
```

If running non-interactively (Docker/CI), create `frontend/components.json` manually with these contents:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

And configure the `@` path alias in `frontend/tsconfig.json` (`"paths": { "@/*": ["./src/*"] }`) and in `frontend/vite.config.ts` (`resolve.alias: { '@': path.resolve(__dirname, './src') }`).

Install Tailwind v3 if not already present:

```
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

**Validation**: `frontend/package.json` exists, `frontend/src/main.tsx` exists, `frontend/components.json` exists (shadcn config).

---

### [x] Step 2 — Install all npm dependencies

**Directory**: `frontend/`

Run in a single command:

```
npm install \
  react-router-dom@6 \
  @tanstack/react-query@5 \
  @tanstack/react-table@8 \
  react-hook-form@7 \
  @hookform/resolvers@3 \
  zod@3 \
  sonner@1 \
  lucide-react \
  clsx \
  tailwind-merge
```

Install the Radix UI primitives and shadcn peer dependencies that back the required components. Do NOT use `npx shadcn@latest add` — the CLI requires an interactive TTY and will hang in Docker or CI. Install packages directly, then generate component files (see note below).

```
npm install \
  @radix-ui/react-dialog \
  @radix-ui/react-sheet \
  @radix-ui/react-select \
  @radix-ui/react-separator \
  @radix-ui/react-label \
  @radix-ui/react-avatar \
  @radix-ui/react-alert-dialog \
  @radix-ui/react-dropdown-menu \
  @radix-ui/react-tooltip \
  @radix-ui/react-scroll-area \
  @radix-ui/react-toggle \
  @radix-ui/react-toggle-group \
  @radix-ui/react-slot \
  class-variance-authority \
  cmdk
```

After installing, run the shadcn add commands **only if you have an interactive terminal** (local dev, not Docker build):

```
npx shadcn@latest add sidebar button card dialog sheet table input label select \
  textarea badge avatar separator skeleton alert-dialog dropdown-menu tooltip \
  form scroll-area toggle toggle-group
```

If the CLI is not available (Docker/CI), copy the component source files from the shadcn/ui GitHub repository (`https://github.com/shadcn-ui/ui/tree/main/apps/www/registry/new-york/ui`) into `frontend/src/components/ui/`. The `cn` utility must exist at `frontend/src/lib/utils.ts`:

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Validation**: `frontend/node_modules/@tanstack/react-query` exists. `frontend/src/components/ui/button.tsx` exists. Run `npm ls react-router-dom` — should show `6.x`.

---

### [x] Step 3 — Configure environment and API base URL

**File to create**: `frontend/.env.development`

```
VITE_API_BASE_URL=http://localhost:8000
```

**File to create**: `frontend/.env.production`

```
VITE_API_BASE_URL=/api
```

**File to create**: `frontend/src/lib/api-client.ts`

This module exports a typed `apiFetch` wrapper. It reads `import.meta.env.VITE_API_BASE_URL` as the base. It accepts `(path: string, options?: RequestInit)` and returns `Promise<T>`. On non-2xx responses it throws an `Error` whose message is the JSON `detail` field if present, otherwise the status text. It sets `Content-Type: application/json` by default (callers override for `multipart/form-data`). Export named `apiFetch`.

**Validation**: File exists at `frontend/src/lib/api-client.ts`. TypeScript compiles clean: `npm run tsc --noEmit`.

---

### [x] Step 4 — Define TypeScript types mirroring Phase 1 Pydantic schemas

**File to create**: `frontend/src/types/index.ts`

Define and export these interfaces exactly matching the backend JSON shapes:

```typescript
export interface FunctionalArea {
  id: number;
  name: string;
  description: string | null;
}

export interface Team {
  id: number;
  functional_area_id: number;
  functional_area?: FunctionalArea;
  name: string;
  description: string | null;
  lead_id: string | null;      // UUID string
  lead?: TeamMember;
  member_count?: number;
}

export interface Program {
  id: number;
  name: string;
  description: string | null;
  member_count?: number;
}

export interface ProgramAssignment {
  program_id: number;
  program?: Program;
  role: string | null;
}

export interface MemberHistory {
  id: number;
  member_uuid: string;
  field: 'salary' | 'bonus' | 'pto_used';
  value: number;
  effective_date: string;   // ISO date string
  notes: string | null;
}

export interface TeamMember {
  uuid: string;
  employee_id: string;
  name: string;
  title: string | null;
  location: string | null;
  image: string | null;     // URL path served by backend
  email: string | null;
  phone: string | null;
  slack_handle: string | null;
  salary: number | null;
  bonus: number | null;
  pto_used: number | null;
  functional_area_id: number | null;
  functional_area?: FunctionalArea;
  team_id: number | null;
  team?: Team;
  supervisor_id: string | null;
  supervisor?: TeamMember;
  program_assignments?: ProgramAssignment[];
  history?: MemberHistory[];
}

// Form input types (omit server-generated fields)
export type TeamMemberFormInput = Omit<TeamMember,
  'uuid' | 'functional_area' | 'team' | 'supervisor' | 'program_assignments' | 'history'
>;

export type ProgramFormInput = Omit<Program, 'id' | 'member_count'>;

export type FunctionalAreaFormInput = Omit<FunctionalArea, 'id'>;

export type TeamFormInput = Omit<Team, 'id' | 'functional_area' | 'lead' | 'member_count'>;
```

**Validation**: `npm run tsc --noEmit` passes with no errors referencing `types/index.ts`.

---

### [x] Step 5 — Build the API query hooks with TanStack Query

**File to create**: `frontend/src/lib/query-client.ts`

Create and export a `QueryClient` instance with `defaultOptions.queries.staleTime` set to `1000 * 60` (1 minute) and `retry` set to `1`.

**File to create**: `frontend/src/hooks/useMembers.ts`

Export the following hooks using `@tanstack/react-query` `useQuery` and `useMutation`. All mutations call `queryClient.invalidateQueries` on success with the appropriate query key.

- `useMembers(params?: { program_id?: number; area_id?: number; team_id?: number; location?: string; search?: string })` — GET `/members` with query params. Query key: `['members', params]`.
- `useMember(uuid: string)` — GET `/members/{uuid}`. Query key: `['members', uuid]`.
- `useCreateMember()` — POST `/members` (multipart/form-data for image support). Invalidates `['members']`.
- `useUpdateMember()` — PUT `/members/{uuid}`. Invalidates `['members']` and `['members', uuid]`.
- `useDeleteMember(uuid: string)` — DELETE `/members/{uuid}`. Invalidates `['members']`.

**File to create**: `frontend/src/hooks/usePrograms.ts`

- `usePrograms()` — GET `/programs`. Query key: `['programs']`.
- `useProgram(id: number)` — GET `/programs/{id}`. Query key: `['programs', id]`.
- `useProgramMembers(id: number)` — GET `/programs/{id}/members`. Query key: `['programs', id, 'members']`.
- `useCreateProgram()`, `useUpdateProgram()`, `useDeleteProgram()` — mutate `/programs`. All invalidate `['programs']`.

**File to create**: `frontend/src/hooks/useFunctionalAreas.ts`

- `useFunctionalAreas()` — GET `/functional-areas`. Query key: `['functional-areas']`.
- `useCreateFunctionalArea()`, `useUpdateFunctionalArea()`, `useDeleteFunctionalArea()` — mutate `/functional-areas`. All invalidate `['functional-areas']`.

**File to create**: `frontend/src/hooks/useTeams.ts`

- `useTeams(area_id?: number)` — GET `/teams` with optional `area_id` query param. Query key: `['teams', { area_id }]`.
- `useCreateTeam()`, `useUpdateTeam()`, `useDeleteTeam()` — mutate `/teams`. All invalidate `['teams']`.

**Validation**: TypeScript compiles clean. No runtime errors when running `npm run dev` and navigating to the app root.

---

### [x] Step 6 — Build the app shell: routing, layout, sidebar

**File to modify**: `frontend/src/main.tsx`

Wrap the app with `<QueryClientProvider client={queryClient}>` (from `frontend/src/lib/query-client.ts`) and `<BrowserRouter>` (from `react-router-dom`). Render `<App />`. Add `<Toaster />` from `sonner` at the top level (outside router, inside QueryClientProvider).

**File to modify**: `frontend/src/App.tsx`

Render a single `<Routes>` block with the following `<Route>` entries:

| Path | Element |
|------|---------|
| `/` | Redirect to `/members` |
| `/members` | `<MembersPage />` |
| `/programs` | `<ProgramsPage />` |
| `/functional-areas` | `<FunctionalAreasPage />` |
| `/teams` | `<TeamsPage />` |

Wrap all page routes in a shared `<AppLayout />` component using a layout route (React Router `<Outlet />`).

**File to create**: `frontend/src/components/layout/AppLayout.tsx`

Use shadcn `SidebarProvider`, `Sidebar`, `SidebarContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton` to render the navigation sidebar. The sidebar contains four nav items:

| Label | Icon (lucide-react) | Path |
|-------|---------------------|------|
| Members | `Users` | `/members` |
| Programs | `Briefcase` | `/programs` |
| Functional Areas | `Layers` | `/functional-areas` |
| Teams | `Network` | `/teams` |

Use `NavLink` from `react-router-dom` inside each `SidebarMenuButton` to apply an active style (bold text / highlighted background) when the route matches. The main content area renders `<Outlet />` inside a `<main>` with padding. The layout is full-viewport-height flex row (sidebar + main).

**File to create**: `frontend/src/components/layout/PageHeader.tsx`

Reusable header component. Props: `title: string`, `description?: string`, `actions?: React.ReactNode`. Renders an `<h1>` and optional `<p>` description left-aligned, and actions right-aligned in a flex row.

**Validation**: Run `npm run dev`. Navigating to `http://localhost:5173` redirects to `/members`. Sidebar renders with all four nav items. Active item is visually distinguished. Clicking nav items changes the URL.

---

### [x] Step 7 — Build shared reusable components

#### 7a. Confirmation dialog

**File to create**: `frontend/src/components/shared/ConfirmDialog.tsx`

Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `title: string`, `description: string`, `onConfirm: () => void`, `loading?: boolean`.

Uses shadcn `AlertDialog`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogCancel`, `AlertDialogAction`. The confirm button shows a spinner (animate-spin `Loader2` icon from lucide-react) when `loading` is true and is disabled during loading.

#### 7b. Search and filter bar

**File to create**: `frontend/src/components/shared/SearchFilterBar.tsx`

Props:
```typescript
interface SearchFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filters: FilterOption[];   // see below
  className?: string;
}

interface FilterOption {
  key: string;
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}
```

Renders a `<Input>` with a `Search` (lucide-react) icon for the search field, and a `<Select>` from shadcn for each filter option. "All" is always the first select option (value `""`). Laid out in a horizontal flex row wrapping on small screens.

#### 7c. Image upload component

**File to create**: `frontend/src/components/shared/ImageUpload.tsx`

Props: `value?: string` (current image URL), `onChange: (file: File | null) => void`, `className?: string`.

Renders a circular `<Avatar>` preview. Below it, a hidden `<input type="file" accept="image/*">` triggered by a "Upload photo" `<Button variant="outline" size="sm">`. When a file is selected, creates a local object URL with `URL.createObjectURL` for the preview and calls `onChange(file)`. A "Remove" button appears when a value or file is present, calls `onChange(null)` and clears the preview.

#### 7d. Data table component

**File to create**: `frontend/src/components/shared/DataTable.tsx`

Generic component using `@tanstack/react-table` v8. Type signature:
```typescript
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  loading?: boolean;
  emptyMessage?: string;
}
```

Uses `useReactTable` with `getCoreRowModel`, `getSortedRowModel`, `getFilteredRowModel`. Renders a shadcn `Table` > `TableHeader` > `TableRow` > `TableHead` (sortable columns show `ArrowUpDown`, `ArrowUp`, or `ArrowDown` lucide icons). Body rows render `TableCell` per cell. When `loading` is true, render 5 skeleton rows (shadcn `Skeleton` component) the full width of the table. When data is empty and not loading, render a single centered row with `emptyMessage` (default: "No results found.").

**Validation**: TypeScript compiles clean. No prop-type errors.

---

### [x] Step 8 — Build the Members page (card view + table view)

#### 8a. Member card component

**File to create**: `frontend/src/components/members/MemberCard.tsx`

Props: `member: TeamMember`, `onEdit: (member: TeamMember) => void`, `onDelete: (member: TeamMember) => void`, `onClick: (member: TeamMember) => void`.

Uses shadcn `Card`, `CardContent`. Layout:
- Top: `Avatar` (image or initials fallback using first+last name initials), name as `<h3>`, title as muted `<p>`.
- Middle: `Badge` for functional area name (if present), badges for each program assignment name.
- Bottom: Location with `MapPin` lucide icon (if present).
- Top-right corner: shadcn `DropdownMenu` triggered by a `MoreVertical` lucide icon button, with "Edit" and "Delete" menu items.

Clicking the card body (not the dropdown) calls `onClick`. The entire card is `cursor-pointer` with a hover shadow transition.

#### 8b. Member detail sheet

**File to create**: `frontend/src/components/members/MemberDetailSheet.tsx`

Props: `member: TeamMember | null`, `open: boolean`, `onOpenChange: (open: boolean) => void`, `onEdit: (member: TeamMember) => void`.

Uses shadcn `Sheet`, `SheetContent` (side: "right", width class `w-[480px] sm:w-[540px]`), `SheetHeader`, `SheetTitle`.

Content sections (use `<Separator />` between sections):
1. **Header**: Large `Avatar`, name, title, employee ID badge.
2. **Contact**: Email (with `Mail` icon), phone (with `Phone` icon), Slack handle (with `Hash` icon), location (with `MapPin` icon). Skip fields that are null.
3. **Organization**: Functional area, team, supervisor name.
4. **Programs**: Each program assignment as a `Badge` with role in parentheses if present.
5. **Compensation**: Salary, bonus, PTO used — formatted as currency/number. Only render section if at least one field is non-null.
6. **History timeline**: Render `member.history` entries (if any) sorted descending by `effective_date`. Each entry shows the field name, value, date, and notes. Use a vertical timeline style with a colored left border.
7. **Edit button**: `<Button>` at the bottom that calls `onEdit(member)`.

If `member` is null, render nothing (return null).

#### 8c. Member form dialog

**File to create**: `frontend/src/components/members/MemberFormDialog.tsx`

Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `member?: TeamMember` (undefined = create mode), `onSuccess?: () => void`.

Uses shadcn `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`.

Form fields (use `react-hook-form` + `zod` for validation):

| Field | Input type | Required | Notes |
|-------|-----------|----------|-------|
| `employee_id` | text | yes | |
| `name` | text | yes | |
| `title` | text | no | |
| `email` | email | no | |
| `phone` | text | no | |
| `slack_handle` | text | no | |
| `location` | text | no | |
| `image` | `ImageUpload` component | no | |
| `functional_area_id` | `Select` (options from `useFunctionalAreas()`) | no | |
| `team_id` | `Select` (options from `useTeams(functional_area_id)`, re-fetched when area changes) | no | |
| `supervisor_id` | `Select` (options from `useMembers()`, excluding self in edit mode) | no | |
| `salary` | number | no | |
| `bonus` | number | no | |
| `pto_used` | number | no | |

Program assignments: a dynamic list. Each entry has a `Select` for program and a text input for role. "Add program" button appends a new row. "Remove" button (X icon) removes a row. Use `useFieldArray` from `react-hook-form`.

On submit: if `member` is undefined, call `useCreateMember()` mutation with `FormData` (append each field; skip null/empty; append image file if provided). If `member` is defined, call `useUpdateMember()` mutation. On success: show toast via `sonner` `toast.success()`, call `onSuccess?.()`, close dialog. On error: show `toast.error()` with the error message.

Dialog title is "Add Member" in create mode and "Edit Member" in edit mode.

Dialog `DialogContent` uses `max-h-[90vh] overflow-y-auto` to handle long forms.

#### 8d. Members page

**File to create**: `frontend/src/pages/MembersPage.tsx`

State managed via URL search params (`useSearchParams` from `react-router-dom`):
- `search` — string
- `program_id` — number string
- `area_id` — number string
- `team_id` — number string
- `view` — `"card"` | `"table"` (default: `"card"`)

Local UI state (not in URL): `detailMember: TeamMember | null`, `editMember: TeamMember | null`, `deleteMember: TeamMember | null`, `addOpen: boolean`.

Data fetched: `useMembers({ search, program_id, area_id, team_id })`, `usePrograms()`, `useFunctionalAreas()`, `useTeams()`.

Page structure:
1. `<PageHeader title="Members" actions={...}>` — actions: view toggle (`ToggleGroup` with `LayoutGrid` and `Table2` lucide icons), "Add Member" `<Button>`.
2. `<SearchFilterBar>` — search input + three `Select` filters: Program, Functional Area, Team.
3. Conditional render based on `view` param:
   - `"card"`: responsive grid (`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`), one `<MemberCard>` per member. Show `<Skeleton>` cards (6) while loading.
   - `"table"`: `<DataTable>` with `memberColumns` (see below).
4. `<MemberDetailSheet>` controlled by `detailMember`.
5. `<MemberFormDialog>` for add (`addOpen`) and edit (`editMember`).
6. `<ConfirmDialog>` for delete — on confirm calls `useDeleteMember()`, shows toast on success/error.

**File to create**: `frontend/src/components/members/memberColumns.tsx`

Export a `memberColumns` array of `ColumnDef<TeamMember>` for use in the table view. Columns:

| Column | Accessor | Sortable | Notes |
|--------|----------|----------|-------|
| Member | `name` | yes | Renders `Avatar` + name + title stacked |
| Employee ID | `employee_id` | yes | |
| Functional Area | `functional_area.name` | yes | Badge |
| Team | `team.name` | yes | |
| Location | `location` | yes | |
| Programs | `program_assignments` | no | Comma-separated program names |
| Actions | — | no | Edit / Delete dropdown, same as card |

**Validation**: `npm run dev`. Members page loads. Toggling card/table view works. Search param updates URL. Filters update URL. Clicking a card opens the detail sheet. "Add Member" button opens the form dialog. Edit and delete actions function correctly. Toast notifications appear on success and error.

---

### [x] Step 9 — Build the Programs page

**File to create**: `frontend/src/pages/ProgramsPage.tsx`

State: `editProgram: Program | null`, `deleteProgram: Program | null`, `addOpen: boolean`, `selectedProgram: Program | null` (for viewing members).

Data fetched: `usePrograms()`.

Page structure:
1. `<PageHeader title="Programs" actions={<Button onClick={() => setAddOpen(true)}>Add Program</Button>}>`.
2. `<DataTable>` with `programColumns`.
3. `<ProgramFormDialog>` for add and edit.
4. `<ConfirmDialog>` for delete.
5. `<Sheet>` (right side) that opens when `selectedProgram` is non-null — shows the program name as title and a list of assigned members (fetched via `useProgramMembers(selectedProgram.id)`). Each member shown as an `Avatar` + name row.

**File to create**: `frontend/src/components/programs/ProgramFormDialog.tsx`

Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `program?: Program`, `onSuccess?: () => void`.

Form fields: `name` (text, required), `description` (textarea, optional). Uses `react-hook-form` + `zod`. Calls `useCreateProgram()` or `useUpdateProgram()`. Shows toast on success/error.

**File to create**: `frontend/src/components/programs/programColumns.tsx`

Columns: Name (sortable, clicking opens the members sheet), Description, Member Count (badge), Actions (Edit / Delete dropdown).

**Validation**: Programs page loads. Table shows all programs with member counts. Add/Edit/Delete work with toasts. Clicking a program name opens the members side sheet.

---

### [x] Step 10 — Build the Functional Areas page

**File to create**: `frontend/src/pages/FunctionalAreasPage.tsx`

State: `editArea: FunctionalArea | null`, `deleteArea: FunctionalArea | null`, `addOpen: boolean`.

Data fetched: `useFunctionalAreas()`.

Page structure:
1. `<PageHeader title="Functional Areas" actions={<Button onClick={() => setAddOpen(true)}>Add Area</Button>}>`.
2. `<DataTable>` with `functionalAreaColumns`.
3. `<FunctionalAreaFormDialog>` for add and edit.
4. `<ConfirmDialog>` for delete.

**File to create**: `frontend/src/components/functional-areas/FunctionalAreaFormDialog.tsx`

Form fields: `name` (text, required), `description` (textarea, optional). Calls `useCreateFunctionalArea()` or `useUpdateFunctionalArea()`. Shows toast on success/error.

**File to create**: `frontend/src/components/functional-areas/functionalAreaColumns.tsx`

Columns: Name (sortable), Description, Team Count (badge, computed from backend response if available, else omit), Actions (Edit / Delete dropdown).

**Validation**: Functional Areas page loads. Table renders. CRUD operations work with toasts.

---

### [x] Step 11 — Build the Teams page

**File to create**: `frontend/src/pages/TeamsPage.tsx`

State: `editTeam: Team | null`, `deleteTeam: Team | null`, `addOpen: boolean`.

Data fetched: `useTeams()`, `useFunctionalAreas()`.

Page structure:
1. `<PageHeader title="Teams" actions={<Button onClick={() => setAddOpen(true)}>Add Team</Button>}>`.
2. `<DataTable>` with `teamColumns`.
3. `<TeamFormDialog>` for add and edit.
4. `<ConfirmDialog>` for delete.

**File to create**: `frontend/src/components/teams/TeamFormDialog.tsx`

Form fields:

| Field | Input type | Required |
|-------|-----------|----------|
| `name` | text | yes |
| `functional_area_id` | `Select` (options from `useFunctionalAreas()`) | yes |
| `description` | textarea | no |
| `lead_id` | `Select` (options from `useMembers()`) | no |

Calls `useCreateTeam()` or `useUpdateTeam()`. Shows toast on success/error.

**File to create**: `frontend/src/components/teams/teamColumns.tsx`

Columns: Name (sortable), Functional Area (sortable), Lead (member name or "—"), Description, Member Count (badge), Actions (Edit / Delete dropdown).

**Validation**: Teams page loads. Table renders with functional area and lead name resolved. CRUD operations work with toasts.

---

### Step 12 — Wire up image serving

The backend (Phase 1) serves uploaded images at `GET /uploads/{filename}`. Member `image` fields contain either a relative path (e.g., `/uploads/abc123.jpg`) or a full URL.

**File to modify**: `frontend/src/lib/api-client.ts`

Export a helper `getImageUrl(path: string | null | undefined): string | undefined` that prepends `import.meta.env.VITE_API_BASE_URL` to relative paths (those starting with `/`). Returns `undefined` if `path` is null/undefined. Used in `Avatar` `src` props throughout the app.

**File to modify**: `frontend/src/components/members/MemberCard.tsx`, `frontend/src/components/members/MemberDetailSheet.tsx`

Use `getImageUrl(member.image)` as the `Avatar` `src`.

**Validation**: Uploading an image through the Add Member form and then viewing the member card shows the image correctly.

---

### Step 13 — Add loading and error states

**File to create**: `frontend/src/components/shared/PageError.tsx`

Props: `message?: string`. Renders a centered `AlertCircle` (lucide-react) icon and error message with a "Retry" button that calls `window.location.reload()`. Used in all pages when the primary query returns `isError: true`.

Add `isError` handling to all four pages (`MembersPage`, `ProgramsPage`, `FunctionalAreasPage`, `TeamsPage`): if `isError` is true, render `<PageError message={error.message} />` instead of the table/grid.

**Validation**: With the backend stopped, navigating to any page shows the error state instead of a blank screen or infinite spinner.

---

### Step 14 — Final integration verification

With `docker compose up` running the full stack:

1. `npm run dev` in `frontend/` starts without errors.
2. `npm run tsc --noEmit` in `frontend/` passes with zero errors.
3. Open `http://localhost:5173`. Sidebar renders. All four nav routes load without console errors.
4. Members page: add a member with an image, verify it appears in the card grid. Edit the member. Delete the member with the confirmation dialog. Verify toasts appear for each action.
5. Members page: switch to table view via toggle. All columns render. Sorting a column reorders rows.
6. Members page: apply a program filter. URL updates with `program_id` param. Results filter. Clear filter restores all members.
7. Click a member card. Detail sheet opens with all sections populated. History section shows if any history exists.
8. Programs page: add a program. Click program name in table — members side sheet opens.
9. Functional Areas page and Teams page: CRUD operations complete without errors.

---

## File Manifest

### New files to create

| File | Purpose |
|------|---------|
| `frontend/.env.development` | Local API base URL |
| `frontend/.env.production` | Production API base URL |
| `frontend/src/lib/api-client.ts` | Typed fetch wrapper + `getImageUrl` helper |
| `frontend/src/lib/query-client.ts` | TanStack Query client instance |
| `frontend/src/types/index.ts` | TypeScript interfaces for all entities |
| `frontend/src/hooks/useMembers.ts` | Member queries and mutations |
| `frontend/src/hooks/usePrograms.ts` | Program queries and mutations |
| `frontend/src/hooks/useFunctionalAreas.ts` | Functional area queries and mutations |
| `frontend/src/hooks/useTeams.ts` | Team queries and mutations |
| `frontend/src/components/layout/AppLayout.tsx` | Sidebar + main content shell |
| `frontend/src/components/layout/PageHeader.tsx` | Reusable page title + actions bar |
| `frontend/src/components/shared/ConfirmDialog.tsx` | Delete confirmation alert dialog |
| `frontend/src/components/shared/SearchFilterBar.tsx` | Search input + filter selects |
| `frontend/src/components/shared/ImageUpload.tsx` | Avatar preview + file input |
| `frontend/src/components/shared/DataTable.tsx` | Generic TanStack Table wrapper |
| `frontend/src/components/shared/PageError.tsx` | Full-page error state |
| `frontend/src/components/members/MemberCard.tsx` | Card view tile |
| `frontend/src/components/members/MemberDetailSheet.tsx` | Slide-out detail panel |
| `frontend/src/components/members/MemberFormDialog.tsx` | Add/Edit member dialog |
| `frontend/src/components/members/memberColumns.tsx` | Table column definitions for members |
| `frontend/src/components/programs/ProgramFormDialog.tsx` | Add/Edit program dialog |
| `frontend/src/components/programs/programColumns.tsx` | Table column definitions for programs |
| `frontend/src/components/functional-areas/FunctionalAreaFormDialog.tsx` | Add/Edit area dialog |
| `frontend/src/components/functional-areas/functionalAreaColumns.tsx` | Table column definitions for areas |
| `frontend/src/components/teams/TeamFormDialog.tsx` | Add/Edit team dialog |
| `frontend/src/components/teams/teamColumns.tsx` | Table column definitions for teams |
| `frontend/src/pages/MembersPage.tsx` | Members page (card + table view) |
| `frontend/src/pages/ProgramsPage.tsx` | Programs page |
| `frontend/src/pages/FunctionalAreasPage.tsx` | Functional Areas page |
| `frontend/src/pages/TeamsPage.tsx` | Teams page |

### Files to modify

| File | Change |
|------|--------|
| `frontend/src/main.tsx` | Add `QueryClientProvider`, `BrowserRouter`, `Toaster` |
| `frontend/src/App.tsx` | Replace default content with `Routes` + `AppLayout` layout route |
| `frontend/src/lib/api-client.ts` | Add `getImageUrl` helper (Step 12) |
| `frontend/src/components/members/MemberCard.tsx` | Use `getImageUrl` (Step 12) |
| `frontend/src/components/members/MemberDetailSheet.tsx` | Use `getImageUrl` (Step 12) |

### shadcn component files (auto-generated, do not hand-edit)

All files under `frontend/src/components/ui/` generated by `npx shadcn@latest add` in Step 2. These are owned by shadcn and will be regenerated if the component is re-added.

---

## Validation Criteria

| Step | Command / Check |
|------|----------------|
| 1 | `test -f frontend/package.json && test -f frontend/components.json` |
| 2 | `cd frontend && npm ls @tanstack/react-query` shows `5.x` |
| 2 | `test -f frontend/src/components/ui/button.tsx` |
| 3 | `cd frontend && npm run tsc -- --noEmit` (no errors in `api-client.ts`) |
| 4 | `cd frontend && npm run tsc -- --noEmit` (no errors in `types/index.ts`) |
| 5 | `cd frontend && npm run tsc -- --noEmit` (no errors in `hooks/`) |
| 6 | Browser: `http://localhost:5173` → redirects to `/members`, sidebar visible |
| 7 | `cd frontend && npm run tsc -- --noEmit` (no errors in `components/shared/`) |
| 8 | Browser: Members card grid loads, card/table toggle works, detail sheet opens |
| 9 | Browser: Programs table loads, members sheet opens on row click |
| 10 | Browser: Functional Areas table loads, CRUD works |
| 11 | Browser: Teams table loads, CRUD works |
| 12 | Browser: Uploaded member image renders in card and detail sheet |
| 13 | Browser (backend stopped): Error state renders on all pages |
| 14 | Full end-to-end walkthrough per Step 14 checklist |

---

## Testing Plan

Testing is implement-then-test. After all implementation steps are complete, write the following tests using Vitest + React Testing Library (both must be installed: `npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`).

### Test configuration

**File to create**: `frontend/vite.config.ts` (modify existing, add `test` block)

Add to Vite config:
```
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./src/test/setup.ts'],
}
```

**File to create**: `frontend/src/test/setup.ts`

Import `@testing-library/jest-dom`.

### Test files to write

**File**: `frontend/src/components/members/__tests__/MemberCard.test.tsx`
- Renders member name, title, and functional area badge.
- Calls `onClick` when card body is clicked.
- Opens dropdown and calls `onEdit` when "Edit" is clicked.
- Opens dropdown and calls `onDelete` when "Delete" is clicked.
- Renders initials in avatar when `member.image` is null.

**File**: `frontend/src/components/shared/__tests__/ConfirmDialog.test.tsx`
- Renders title and description when `open` is true.
- Calls `onConfirm` when confirm button is clicked.
- Calls `onOpenChange(false)` when cancel button is clicked.
- Confirm button is disabled and shows spinner when `loading` is true.

**File**: `frontend/src/components/shared/__tests__/DataTable.test.tsx`
- Renders column headers.
- Renders correct number of rows for given data.
- Renders skeleton rows when `loading` is true.
- Renders empty message when data is empty and not loading.

**File**: `frontend/src/pages/__tests__/MembersPage.test.tsx`

Mock `useMembers`, `usePrograms`, `useFunctionalAreas`, `useTeams` with `vi.mock`. Tests:
- Renders member cards in card view (default).
- Toggling to table view renders the `DataTable`.
- Typing in search input updates the URL `search` param.
- Clicking "Add Member" opens `MemberFormDialog`.
- Clicking edit on a card opens `MemberFormDialog` in edit mode (title is "Edit Member").
- Clicking delete on a card opens `ConfirmDialog`.

### Run tests

```
cd frontend && npm run test
```

All tests must pass before Phase 2 is considered complete.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Phase 1 backend API shapes differ from assumed schemas | Verify actual response shapes from `GET /members`, `GET /programs`, `GET /functional-areas`, `GET /teams` before writing types in Step 4. Adjust `types/index.ts` accordingly. |
| shadcn CLI hangs in Docker/CI (no TTY) | Do NOT use `npx shadcn@latest add` in non-interactive environments. Install Radix UI packages directly via npm and copy component source files from the shadcn GitHub repo instead. |
| shadcn Sidebar component API varies by version | Pin `shadcn@latest` at install time and read generated `components/ui/sidebar.tsx` to confirm sub-component export names before using in `AppLayout.tsx`. |
| `@` path alias not configured | Both `tsconfig.json` (paths) and `vite.config.ts` (resolve.alias) must be updated to resolve `@/` to `./src/` — `shadcn@latest init` normally does this; if doing it manually, both files must be updated or all shadcn component imports will fail. |
| `multipart/form-data` for member create with image requires special handling | Do NOT set `Content-Type` header manually for FormData requests — let the browser set it with the boundary. The `apiFetch` wrapper must detect `FormData` bodies and omit the `Content-Type` header. |
| TanStack Query v5 API differs from v4 | Use v5 API throughout: `useQuery({ queryKey, queryFn })` object syntax (not positional args). `useMutation({ mutationFn })` object syntax. `onSuccess` is no longer a top-level option in v5 — use the returned `mutateAsync` with `.then()` or pass callbacks to `mutate()`. |
| Circular type reference in `TeamMember` (supervisor is a `TeamMember`) | TypeScript handles self-referential interfaces natively. No special handling needed, but avoid deep recursive rendering in components — show supervisor name only, not a full nested card. |
| URL search params with `useSearchParams` cause full re-renders | Use a single `setSearchParams` call that merges new params with existing ones to avoid wiping unrelated filters on each change. |
