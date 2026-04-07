# PRP — Feature 056: Multi-Program Member Import

## Status: COMPLETE
## Testing Strategy: implement-then-test (project default)

## Context

Members in `team-resourcer` already have a many-to-many relationship to programs via the `program_assignments` table (composite PK on `(member_uuid, program_id)`, nullable `role` and `program_team_id`). The data model is fully ready for multi-program. **The gap is the import pipeline and the visual layer**, both of which still assume a member belongs to exactly one program.

This feature adds end-to-end support for importing a member into multiple programs at once via a semicolon-delimited cell, applies replace-semantics on commit (programs not listed are unassigned), and updates the UI so cards, the program tree, and detail views all surface multiple-program membership clearly.

User-resolved decisions (from `.context/features/056-multi-program-member-import/NOTES.md`):
- **CSV format**: Option A — single cell, `;`-delimited (e.g., `"Alpha; Beta"`).
- **Roles**: one `program_role` value applied to every program in the row.
- **Reconciliation**: replace semantics — unassign programs not in the row.
- **Program teams**: in scope. Parallel `;`-list `program_team_names` aligned positionally with `program_names`. Optional column; blank tokens allowed.
- **Tree visual**: single member node with a multi-program badge (no duplicate nodes).
- **Backwards compat**: cells with no `;` continue to import as a single-program assignment.
- **Dry-run UX**: preview must explicitly call out unassignments per member.

## Approach

Five layers of change, ordered by dependency:

### 1. Backend — Import mapper (`backend/app/services/import_mapper.py`)

- Rename target field `program_name` → `program_names` (list semantics) in `ENTITY_CONFIGS["member"]`. Add `program_team_names` to the target_fields set. Keep `program_role` scalar.
- Add a `_split_semicolon_list(value)` helper near the top of the file: splits on `;`, strips each token, drops empties. A cell with no `;` returns a single-element list — preserves backward compat.
- In `apply_mapping`, after column-map application, normalize `program_names` and `program_team_names` from raw strings to `list[str]` on the row's `data` dict (store as Python list — `MappedRow.data` is `dict[str, Any]`).
- Add a member-specific validator `_validate_program_lists(data, errors)`:
  - If both `program_names` and `program_team_names` are present and non-empty, the **non-blank token counts must match position-wise** (i.e., the lists must have the same length, but blank `program_team_names` tokens are allowed at any index — they mean "no team for that program").
  - Mismatch → row error: `"program_team_names must align positionally with program_names"`.
- Dedup logic stays as-is. Each member is still one row; no merge mode needed.

### 2. Backend — Commit (`backend/app/services/import_commit_members.py`)

- Replace lines 55–59 (single-program resolve) with a loop that resolves each name in `data["program_names"]` to a `Program` via `_get_or_create_program`. Build a list `[(program, team_name_or_none), ...]` paired with `program_team_names`.
- Replace lines 120–124 (single `_upsert_program_assignment` call) with:
  1. Loop over the resolved list and call `_upsert_program_assignment(db, member.uuid, program.id, role)` for each. (Role is the single shared `program_role` value.)
  2. If a `team_name` is non-blank for that position, resolve/create a `ProgramTeam` for `(program.id, team_name)` and set `assignment.program_team_id`. Need a new helper `_get_or_create_program_team(db, program_id, name)` in `import_commit.py` mirroring `_get_or_create_team`.
  3. **Replace semantics**: after the assign loop, `select` all existing `ProgramAssignment` rows for `member.uuid`, compute `existing_program_ids - incoming_program_ids`, and `db.delete()` the deltas. Skip this entirely if the row had no program columns mapped at all (preserves "import without touching programs" use case — distinct from "import with empty programs cell" which is a no-op intent we leave as-is unless user clarifies later).
- Extend `_upsert_program_assignment` signature (in `import_commit.py`) to accept an optional `program_team_id: int | None = None` so the caller can set it in one place. Update existing assignment row's `program_team_id` if a new value is supplied.

### 3. Backend — Member list endpoint eager load

- Locate the member list service (likely `backend/app/services/member_service.py` or `backend/app/api/routes/members.py`) and add `selectinload(TeamMember.program_assignments).selectinload(ProgramAssignment.program)` and `.selectinload(ProgramAssignment.program_team)` to the list query.
- This is required because (a) `MemberCard` already references `program_assignments` (latent bug — see `.context/errors/INDEX.md` `MissingGreenlet` pattern from feature 050), and (b) every list view will now visibly need it.
- Update the response schema (`MemberRead` or equivalent) to include `program_assignments` if not already serialized.

### 4. Frontend — Import wizard

- `frontend/src/components/import/MapColumnsStep.tsx`: replace the `Program` target field entry with `{ label: 'Programs (semicolon-separated)', value: 'program_names' }` and add `{ label: 'Program Teams (semicolon-separated)', value: 'program_team_names' }` immediately after. Keep `program_role` as-is with updated label `'Program Role (applied to all)'`.
- The dry-run preview step (find the component that renders `MappedPreviewResult` — likely `PreviewStep.tsx` in the same `import/` folder): for each row that will trigger an unassignment, display a "Will unassign: X, Y" warning chip. This requires the backend to surface the diff. Two options:
  - **Cheap path**: backend `apply_mapping` doesn't know about existing DB state, so we can't compute unassignments at preview time without a DB hit. Add a new lightweight pass at preview time (or extend the preview endpoint) that, for each `employee_id` in the mapped set, queries existing assignments and emits the diff as a row warning. This is read-only and acceptable on a preview endpoint.
  - **Compromise**: gate this behind a `compute_unassignments=true` flag on the preview API to keep dry-run cheap by default. The wizard sets it on the final preview before commit.
- Type updates in `frontend/src/api/importApi.ts` if `MappedPreviewResult` needs a new `unassignments` field per row.

### 5. Frontend — Member visuals

- **MemberCard** (`frontend/src/components/members/MemberCard.tsx:104–111`): show first 2 program badges; if `program_assignments.length > 2`, render a `+N` chip with a `title` tooltip listing the rest. Each badge can render `pa.program.name` plus, if `pa.program_team`, a smaller subscript like `· TeamA`.
- **MemberDetailSheet** (`frontend/src/components/members/MemberDetailSheet.tsx:185–200`): already renders all programs from the detail endpoint — no change needed beyond ensuring the rendered chip shows program team name when present.
- **Program tree** (feature 055 area, `frontend/src/components/programs/ProgramTree.tsx` or similar): a member appearing in multiple programs renders **once per program** in tree position, but each occurrence carries a `×N` badge indicating "this member is in N programs total". This matches the user's "single node with multi-badge" decision while still letting the user see the member under each program they belong to. Counts in feature 051 should remain unique-by-member at the program level (no double-count).
  - If the tree currently picks "the" program for a member from a single FK, that lookup needs to switch to iterating `member.program_assignments`.

## Critical Files

| File | Purpose |
|------|---------|
| `backend/app/services/import_mapper.py` | Add list parsing + validator |
| `backend/app/services/import_commit_members.py` | Multi-program resolve + replace loop |
| `backend/app/services/import_commit.py` | Extend `_upsert_program_assignment`, add `_get_or_create_program_team` |
| `backend/app/services/member_service.py` (or routes/members.py) | Eager-load `program_assignments` on list |
| `backend/app/schemas/member.py` (or wherever `MemberRead` lives) | Surface `program_assignments` on list response |
| `backend/app/schemas/import_schemas.py` | Optional: per-row `unassignments` field on `MappedRow` |
| `frontend/src/components/import/MapColumnsStep.tsx` | New target fields |
| `frontend/src/components/import/PreviewStep.tsx` (or equivalent) | Render unassignment warnings |
| `frontend/src/api/importApi.ts` | Type updates |
| `frontend/src/components/members/MemberCard.tsx` | Multi-badge with `+N more` |
| `frontend/src/components/programs/ProgramTree.tsx` | Multi-program badge per occurrence |

## Reused Utilities

- `_get_or_create_program` (`import_commit.py:56`) — call in a loop for each token.
- `_upsert_program_assignment` (`import_commit.py:67`) — extend with optional `program_team_id`.
- `_get_or_create_team` (`import_commit.py:38`) — pattern to mirror for `_get_or_create_program_team`.
- `useMemberForm.ts:35` — already uses `program_ids: z.array(z.string())`; serves as the model for how multi-program data flows through forms.

## Risks & Mitigations

- **Destructive replace**: a partial-data CSV could wipe valid assignments. Mitigated by the explicit "will unassign" preview warnings (Section 4) — the user must see deltas before commit.
- **`MissingGreenlet`** when adding `program_assignments` to list endpoint: must add `selectinload` in the same change. See `.context/errors/INDEX.md` (feature 050).
- **Token strip/empty handling**: `"; Alpha;;Beta;"` must become `["Alpha", "Beta"]`. Helper must be defensive — covered by unit tests on `_split_semicolon_list`.
- **Length-mismatch validation**: two `;`-lists of different cardinality silently misalign data. Validator must hard-error on mismatch.
- **Tree double-counting**: feature 051 program member counts must continue to count distinct members per program (no inflation). Verify after change.

## Verification

End-to-end manual test:
1. `make reset-db && make up`
2. Prepare a CSV with 3 members:
   - Member A: `program_names = "Alpha"`, `program_team_names = ""` (single-program backward-compat case)
   - Member B: `program_names = "Alpha; Beta"`, `program_team_names = "Team1; Team2"`, `program_role = "Engineer"`
   - Member C: `program_names = "Beta; Gamma; Delta"`, `program_team_names = ""` (multi-program, no teams)
3. Import via wizard. Confirm preview shows row counts and any unassignment warnings.
4. After commit:
   - Card view: Member B shows 2 program badges; Member C shows `Beta`, `Gamma`, `+1` with tooltip including `Delta`.
   - Detail sheet: all programs and program teams render.
   - Program tree: Member B appears under Alpha and Beta nodes; Member C appears under Beta, Gamma, Delta. Each occurrence carries a `×N` chip.
5. Re-import with Member B's row changed to `program_names = "Alpha"` only. Preview must warn `"Will unassign: Beta"`. After commit, Member B has only Alpha.

Automated tests (per project default — implement-then-test):
- `backend/tests/services/test_import_mapper.py` — add cases for `_split_semicolon_list`, length-mismatch validator, single-cell backward compat.
- `backend/tests/services/test_import_commit_members.py` — assert multi-program upsert, replace semantics (unassignment of dropped programs), program-team linkage.
- `backend/tests/api/test_members_routes.py` — assert list endpoint returns `program_assignments` and does not raise `MissingGreenlet`.
- `frontend/src/components/members/__tests__/MemberCard.test.tsx` — assert `+N more` rendering.
- Run: `make test`, `cd frontend && npx vitest run`, `make lint`, `make typecheck`.

## Out of Scope

- Per-program distinct roles (user chose single shared role).
- Tree node de-duplication (user chose appearance under each program).
- Editing program-team assignments via the import wizard preview (use the edit form post-import).
