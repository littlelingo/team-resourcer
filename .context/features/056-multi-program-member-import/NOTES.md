# Feature 056 — Multi-Program Member Import

## Goal
Allow a member to belong to more than one program, supported end-to-end: CSV import, backend data/commit, and frontend visuals.

## User Decisions
1. **Approach**: Option A — semicolon-delimited single cell (e.g., `"Alpha; Beta; Gamma"`).
2. **Delimiter**: `;`
3. **Role handling**: a single `program_role` value is applied to every program in the list.
4. **Reconciliation**: replace semantics — programs not listed on the import row are **unassigned** from the member.
5. **`program_team_id`**: in scope. Members may be linked to multiple program teams (one per program), and visuals must reflect this.

## Current State (from researcher)

### Data model — already M2M ✅
- `program_assignments` table: composite PK `(member_uuid, program_id)`, nullable `role` and `program_team_id`.
- No `program_id` FK on `team_members` (never existed — initial migration `452ccece7038`).
- `_upsert_program_assignment` in `backend/app/services/import_commit.py:67–83` already handles idempotent insert.
- **No schema changes required.**

### Import layer — single-program only ❌
- `backend/app/services/import_mapper.py` `ENTITY_CONFIGS["member"]` (lines 54–79): `program_name` / `program_role` are scalar string fields.
- Dedup on `employee_id` (lines 183–195) **silently skips** repeat rows — rules out "one row per program" without a new merge mode.
- `backend/app/services/import_commit_members.py` `_commit_members` (lines 55–124): reads one `program_name`, resolves one program, calls `_upsert_program_assignment` once per row.
- Frontend `frontend/src/components/import/MapColumnsStep.tsx` `MEMBER_TARGET_FIELDS` (lines 14–33): exposes exactly one `Program` / `Program Role` target.

### Visual layer — partially ready, one latent bug
- `frontend/src/components/members/useMemberForm.ts:35` — edit form already uses `program_ids: z.array(z.string())` with a diff-based assign/unassign loop (lines 183–215). **Already multi-program capable.**
- `frontend/src/components/members/MemberDetailSheet.tsx:185–200` — renders program badges from the detail endpoint. Works for N programs today.
- `frontend/src/components/members/MemberCard.tsx:104–111` — attempts to render `member.program_assignments?.map(...)` badges, but **the list endpoint does not eager-load `program_assignments`**, so the array is `undefined` at runtime. Latent bug; becomes a hard blocker for this feature.
- Program tree (feature 055): a member assigned to multiple programs currently appears under only one. With multi-program, the tree needs to either duplicate the member under each program (clear provenance) or add a "multi-program" visual affordance.

## Gaps to Fill

| # | Layer | File | Change |
|---|-------|------|--------|
| 1 | Import mapper | `backend/app/services/import_mapper.py` | Replace scalar `program_name` with a list-valued target (e.g., `program_names`) that parses `;`-delimited cells. Keep `program_role` scalar (applies to all). |
| 2 | Commit | `backend/app/services/import_commit_members.py` | Loop resolved programs; call `_upsert_program_assignment` per program. Implement **replace semantics**: fetch existing assignments, diff against incoming list, unassign the delta. |
| 3 | program_team handling | `backend/app/services/import_commit_members.py` | Decide how program-team is expressed in the CSV — open question below. |
| 4 | Frontend mapper | `frontend/src/components/import/MapColumnsStep.tsx` | Update target field metadata + any helper text to document `;`-delimited input. |
| 5 | Member list endpoint | `backend/app/api/routes/members.py` + service | Add `selectinload(Member.program_assignments)` (watch for `MissingGreenlet` per feature 050 error index) so cards/tables can render badges. |
| 6 | MemberCard | `frontend/src/components/members/MemberCard.tsx` | With multi-program now real, decide truncation UX: show first 2 badges + `+N more`, with tooltip or click-to-expand. |
| 7 | Program tree | `frontend/src/components/programs/...` (feature 055 area) | A member in N programs should appear under each, or alternatively once with a "multi" indicator. Needs design call. |

## Risks

- **Destructive replace semantics**: a partial/filtered import that only lists one program for a member will wipe all other assignments. Must be loud in the import preview (diff view showing "will remove: X, Y") before commit. Recommend surfacing `unassign` deltas in the dry-run step.
- **`MissingGreenlet`** (from `.context/errors/INDEX.md`, feature 050): adding `program_assignments` to the list endpoint without eager-loading will crash under the async session. Every new load path needs `selectinload`.
- **Program name collisions**: `_get_or_create_program` is called per token — a typo like `"Alpha ; Beta"` with a stray space creates `"Alpha "` as a new program. Must `.strip()` each token and skip empties.
- **Role semantics drift**: single role applied to all programs means editing one program's role post-import diverges from the CSV. This is by user decision — document it.
- **Tree duplication**: if a member appears under multiple programs in the tree, member counts (feature 051) may need to clarify "unique vs. appearance" counts to avoid double-counting.

## Resolved Questions (round 2)

1. **program_team CSV**: parallel `;`-list — `program_names` = `"Alpha; Beta"` paired positionally with `program_team_names` = `"TeamA; TeamB"`. Team column is **optional**; import must succeed when it is absent or partially blank (blank token → no team on that program).
2. **Tree visual**: single node with a multi-program badge (e.g., "×3" or stacked pills). Member appears once; counts stay accurate. No duplication under each program.
3. **Preview UX**: dry-run must explicitly surface unassignments as a "will remove" warning list per member. Cannot be silent.
4. **Backwards compat**: a cell without `;` must continue to import as a single-program assignment, unchanged. No user-visible regression for existing CSVs.

## Next
`/planner .context/features/056-multi-program-member-import/NOTES.md`
