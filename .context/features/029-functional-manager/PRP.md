---
feature: "029 — Functional Manager + Direct Report Rename"
phase: implementation
status: COMPLETE
testing: implement-then-test
complexity: MEDIUM
depends_on: "d8e2f3a4c501 (member_location_split)"
---

## Feature: 029 — Functional Manager + Direct Report Rename
## Status: APPROVED
## Testing Strategy: implement-then-test
## Complexity: MEDIUM

### Goal

Add a second self-referencing foreign key (`functional_manager_id`) to `team_members`, expose it through the full backend stack (model → schemas → service → route), rename the "Supervisor" UI label to "Direct Manager", and display the resolved functional manager name on the member card and detail sheet.

---

### Steps

---

#### Step 1: Alembic migration — add `functional_manager_id` column + FK

- **Files:**
  - `backend/alembic/versions/<new_revision>_add_functional_manager_id.py` (generated)

- **Changes:**
  1. From inside the backend container (or with the backend virtualenv active), generate a new migration with:
     ```
     docker compose exec backend alembic revision --autogenerate -m "add_functional_manager_id"
     ```
  2. Verify the generated file contains an `upgrade()` that:
     - Calls `op.add_column("team_members", sa.Column("functional_manager_id", sa.UUID(), nullable=True))`.
     - Calls `op.create_foreign_key("fk_team_members_functional_manager_id", "team_members", "team_members", ["functional_manager_id"], ["uuid"])`.
  3. Verify the `downgrade()` drops the FK constraint first, then the column (same order as upgrade, reversed).
  4. Set the `down_revision` to `"d8e2f3a4c501"`.
  5. The autogenerate output may not produce exactly the above if the model changes in Step 2 are done first. Either approach is fine — what matters is the final migration file matches these two operations.

- **Validation:**
  ```bash
  docker compose exec backend alembic upgrade head
  docker compose exec db psql -U postgres -d teamresourcer -c "\d team_members" | grep functional_manager_id
  # Expect: functional_manager_id | uuid | ...
  docker compose exec backend alembic downgrade -1
  docker compose exec backend alembic upgrade head
  ```

---

#### Step 2: Model — add column and relationships

- **Files:**
  - `backend/app/models/team_member.py`

- **Changes:**
  1. After the `supervisor_id` mapped column (currently lines 47–51), add a new mapped column:
     ```python
     functional_manager_id: Mapped[uuid.UUID | None] = mapped_column(
         UUID(as_uuid=True),
         ForeignKey("team_members.uuid"),
         nullable=True,
     )
     ```
  2. After the `direct_reports` relationship (currently lines 86–90), add two new relationships:
     ```python
     functional_manager: Mapped[TeamMember | None] = relationship(
         "TeamMember",
         back_populates="functional_reports",
         foreign_keys=[functional_manager_id],
         remote_side="TeamMember.uuid",
     )
     functional_reports: Mapped[list[TeamMember]] = relationship(
         "TeamMember",
         back_populates="functional_manager",
         foreign_keys="TeamMember.functional_manager_id",
     )
     ```
  3. The existing `supervisor` and `direct_reports` relationships already carry `foreign_keys=` — do not remove them. Both new relationships must also carry `foreign_keys=` or SQLAlchemy will raise `AmbiguousForeignKeysError` at startup.

- **Validation:**
  ```bash
  make typecheck
  # Backend should start without AmbiguousForeignKeysError:
  docker compose exec backend python -c "from app.models.team_member import TeamMember; print('ok')"
  ```

---

#### Step 3: Schemas — add `functional_manager_id` and resolved objects

- **Files:**
  - `backend/app/schemas/team_member.py`
  - `backend/app/schemas/org.py`
  - `backend/app/schemas/__init__.py`

- **Changes to `backend/app/schemas/team_member.py`:**
  1. In `TeamMemberCreate` (after `supervisor_id: UUID | None = None`, currently line 34), add:
     ```python
     functional_manager_id: UUID | None = None
     ```
  2. In `TeamMemberUpdate` (after `supervisor_id: UUID | None = None`, currently line 67), add:
     ```python
     functional_manager_id: UUID | None = None
     ```
  3. Add a new minimal inline schema above `TeamMemberDetailResponse` to represent a resolved manager reference. Name it `MemberRefResponse`:
     ```python
     class MemberRefResponse(BaseModel):
         model_config = ConfigDict(from_attributes=True)
         uuid: UUID
         first_name: str
         last_name: str
     ```
  4. In `TeamMemberDetailResponse`, after `supervisor_id: UUID | None` (currently line 114), add:
     ```python
     functional_manager_id: UUID | None
     supervisor: MemberRefResponse | None = None
     functional_manager: MemberRefResponse | None = None
     ```
     The `supervisor` field replaces the raw-UUID-only display in the detail sheet. Pydantic will serialize the loaded ORM relationship object automatically because `from_attributes=True` is set.
  5. In `TeamMemberListResponse`, add two computed-name fields after `team_id`:
     ```python
     supervisor_name: str | None = None
     functional_manager_name: str | None = None
     ```
     These will be `None` unless the service layer populates them. Because the list query does not load the supervisor/functional_manager relationships by default (see Step 4), these fields will remain `None` in list responses until the service is updated. Adding them to the schema now keeps the frontend type stable.

- **Changes to `backend/app/schemas/org.py`:**
  1. After `class SupervisorUpdate`, add:
     ```python
     class FunctionalManagerUpdate(BaseModel):
         functional_manager_id: UUID | None = None
     ```

- **Changes to `backend/app/schemas/__init__.py`:**
  1. In the `from app.schemas.org import ...` line, add `FunctionalManagerUpdate` to the import.
  2. In the `from app.schemas.team_member import ...` line, add `MemberRefResponse` to the import.
  3. Add both to the `__all__` list under their respective sections.

- **Validation:**
  ```bash
  make typecheck
  docker compose exec backend python -c "from app.schemas import FunctionalManagerUpdate, MemberRefResponse; print('ok')"
  ```

---

#### Step 4: Service — member_service eager load + list supervisor names

- **Files:**
  - `backend/app/services/member_service.py`

- **Changes:**
  1. In `get_member`, add `selectinload(TeamMember.functional_manager)` to the options chain alongside the existing `selectinload(TeamMember.supervisor)`. The updated options block should be:
     ```python
     .options(
         selectinload(TeamMember.functional_area),
         selectinload(TeamMember.team),
         selectinload(TeamMember.supervisor),
         selectinload(TeamMember.functional_manager),
         selectinload(TeamMember.history),
         selectinload(TeamMember.program_assignments).selectinload(ProgramAssignment.program),
     )
     ```
  2. In `list_members`, add eager loading of `supervisor` and `functional_manager` so the list response can include resolved names. Add to the existing options:
     ```python
     selectinload(TeamMember.supervisor),
     selectinload(TeamMember.functional_manager),
     ```
     After loading, the ORM objects will carry `.supervisor` and `.functional_manager` relationship attributes. However, `TeamMemberListResponse` does not have `from_attributes=True` wiring to auto-resolve these into `supervisor_name`/`functional_manager_name`. The Pydantic model will need computed values.

     Because `TeamMemberListResponse` uses `from_attributes=True`, Pydantic will try to read `supervisor_name` and `functional_manager_name` as attributes directly from the ORM object — but those are not columns. Add a `@property` to the `TeamMember` model that derives them:

     In `backend/app/models/team_member.py`, after the `name` property, add:
     ```python
     @property
     def supervisor_name(self) -> str | None:
         if self.supervisor is not None:
             return self.supervisor.name
         return None

     @property
     def functional_manager_name(self) -> str | None:
         if self.functional_manager is not None:
             return self.functional_manager.name
         return None
     ```

     The `name` property (`f"{self.first_name} {self.last_name}".strip()`) is already defined at line 63. These new properties follow the same pattern.

     Note: these properties will only return a value when the `supervisor`/`functional_manager` relationships have been eagerly loaded. In contexts where only `get_member` or `list_members` (after this step's changes) called the load, the property is safe. Do not call these properties on partially-loaded ORM objects from other code paths.

- **Validation:**
  ```bash
  make test
  # Specifically: the existing test_members_routes.py tests should still pass
  # Manually verify the list endpoint returns supervisor_name:
  curl -s http://localhost:8000/api/members/ | python3 -m json.tool | grep supervisor_name
  ```

---

#### Step 5: Service — org_service `set_functional_manager` with cycle detection

- **Files:**
  - `backend/app/services/org_service.py`
  - `backend/app/services/__init__.py`

- **Changes to `backend/app/services/org_service.py`:**
  1. After the `set_supervisor` function (lines 49–71), add a new `set_functional_manager` function. It follows the exact same structure as `set_supervisor` but operates on `functional_manager_id`. The cycle detection must walk the `functional_manager_id` chain, not `supervisor_id`.

     Function signature:
     ```python
     async def set_functional_manager(
         db: AsyncSession,
         member_uuid: uuid.UUID,
         functional_manager_id: uuid.UUID | None,
     ) -> TeamMember | None:
     ```

     Guards to implement (same as `set_supervisor`):
     - If `functional_manager_id == member_uuid`, raise `ValueError("A member cannot be their own functional manager.")`.
     - Call `await _check_no_functional_cycle(db, member_uuid, functional_manager_id)`.

  2. Add a private `_check_no_functional_cycle` function after `_check_no_cycle`. It is structurally identical to `_check_no_cycle` but reads `TeamMember.functional_manager_id` in its `select` statement instead of `TeamMember.supervisor_id`. The error message raised should reference "functional manager" to distinguish it from the supervisor cycle error.

- **Changes to `backend/app/services/__init__.py`:**
  1. Add `set_functional_manager` to the import from `app.services.org_service`.
  2. Add `"set_functional_manager"` to `__all__`.

- **Validation:**
  ```bash
  make test
  docker compose exec backend python -c "from app.services import set_functional_manager; print('ok')"
  ```

---

#### Step 6: Route — add `PUT /api/org/members/{uuid}/functional-manager`

- **Files:**
  - `backend/app/api/routes/org.py`
  - `backend/app/schemas/__init__.py` (already updated in Step 3)

- **Changes to `backend/app/api/routes/org.py`:**
  1. Add `FunctionalManagerUpdate` to the `from app.schemas import ...` line alongside `SupervisorUpdate`.
  2. Add `set_functional_manager` to the `from app.services import ...` line alongside `set_supervisor`.
  3. After the `set_supervisor_route` handler, add a new route handler:
     ```python
     @router.put("/members/{member_uuid}/functional-manager", response_model=TeamMemberDetailResponse)
     async def set_functional_manager_route(
         member_uuid: UUID,
         data: FunctionalManagerUpdate,
         db: AsyncSession = Depends(get_db),
     ) -> TeamMemberDetailResponse:
         """Set or clear the functional manager for a member by UUID."""
         try:
             member = await set_functional_manager(db, member_uuid, data.functional_manager_id)
         except ValueError as exc:
             raise HTTPException(status_code=400, detail=str(exc)) from exc
         if member is None:
             raise HTTPException(status_code=404, detail="Member not found")
         return member
     ```

- **Validation:**
  ```bash
  make test
  # Smoke test with curl (requires two real member UUIDs from your DB):
  curl -s -X PUT http://localhost:8000/api/org/members/<MEMBER_UUID>/functional-manager \
    -H "Content-Type: application/json" \
    -d '{"functional_manager_id": "<MANAGER_UUID>"}' | python3 -m json.tool | grep functional_manager_id
  # Expect: "functional_manager_id": "<MANAGER_UUID>"
  ```

---

#### Step 7: Frontend types

- **Files:**
  - `frontend/src/types/index.ts`

- **Changes:**
  1. In `TeamMemberList` (lines 77–90), add after `team_id: number | null`:
     ```typescript
     supervisor_name: string | null
     functional_manager_name: string | null
     ```
  2. In `TeamMember extends TeamMemberList` (lines 92–108), add after `supervisor_id: string | null`:
     ```typescript
     functional_manager_id: string | null
     supervisor?: { uuid: string; first_name: string; last_name: string } | null
     functional_manager?: { uuid: string; first_name: string; last_name: string } | null
     ```
  3. In `MemberFormInput` (lines 112–129), add after `supervisor_id?: string`:
     ```typescript
     functional_manager_id?: string
     ```

- **Validation:**
  ```bash
  cd frontend && npx tsc --noEmit
  ```

---

#### Step 8: Frontend MemberFormDialog — add functional manager field, rename "Supervisor" label

- **Files:**
  - `frontend/src/components/members/MemberFormDialog.tsx`

- **Changes:**
  1. In the Zod schema (around line 34), after `supervisor_id: z.string()`, add:
     ```typescript
     functional_manager_id: z.string(),
     ```
  2. In the default values block (around line 101), after `supervisor_id: member?.supervisor_id ?? ''`, add:
     ```typescript
     functional_manager_id: member?.functional_manager_id ?? '',
     ```
  3. In the submit handler `onSubmit`, in both the update branch (around line 150) and the create branch (around line 174), after `supervisor_id: values.supervisor_id || undefined`, add:
     ```typescript
     functional_manager_id: values.functional_manager_id || undefined,
     ```
  4. In the JSX, change the `<Field label="Supervisor">` (around line 380) to:
     ```tsx
     <Field label="Direct Manager">
     ```
     Keep `name="supervisor_id"` and `placeholder="Select direct manager"` on the underlying `SelectField` (the Zod field name and API field name do not change).
  5. After the Direct Manager field block and before the Compensation section, add a new Functional Manager field using the exact same pattern as the supervisor `SelectField`:
     ```tsx
     <Field label="Functional Manager">
       <Controller
         control={control}
         name="functional_manager_id"
         render={({ field }) => (
           <SelectField
             value={field.value}
             onChange={field.onChange}
             placeholder="Select functional manager"
             options={supervisorOptions}
           />
         )}
       />
     </Field>
     ```
     Reuse `supervisorOptions` (the options list that excludes self and maps all members to `{ label, value }`). Both managers draw from the same pool of all members.

- **Validation:**
  ```bash
  cd frontend && npx tsc --noEmit
  cd frontend && npx vitest run
  # Visually verify in browser: open Add Member dialog — should show "Direct Manager" and "Functional Manager" select fields
  ```

---

#### Step 9: Frontend MemberDetailSheet — fix supervisor display, add functional manager row

- **Files:**
  - `frontend/src/components/members/MemberDetailSheet.tsx`

- **Changes:**
  1. Find the Organization section conditional guard (around line 133):
     ```tsx
     {(member.functional_area || member.team || member.supervisor_id) && (
     ```
     Update it to also show when `functional_manager_id` is set:
     ```tsx
     {(member.functional_area || member.team || member.supervisor_id || member.functional_manager_id) && (
     ```
  2. Replace the existing raw-UUID supervisor display block (around lines 152–157):
     ```tsx
     {member.supervisor_id && (
       <div className="flex items-center justify-between">
         <span className="text-slate-500">Supervisor ID</span>
         <span className="font-mono text-xs">{member.supervisor_id}</span>
       </div>
     )}
     ```
     With a resolved-name display using the `supervisor` object added in Step 3:
     ```tsx
     {member.supervisor && (
       <div className="flex items-center justify-between">
         <span className="text-slate-500">Direct Manager</span>
         <span>{member.supervisor.first_name} {member.supervisor.last_name}</span>
       </div>
     )}
     ```
  3. After the Direct Manager row, add a Functional Manager row:
     ```tsx
     {member.functional_manager && (
       <div className="flex items-center justify-between">
         <span className="text-slate-500">Functional Manager</span>
         <span>{member.functional_manager.first_name} {member.functional_manager.last_name}</span>
       </div>
     )}
     ```

- **Validation:**
  ```bash
  cd frontend && npx tsc --noEmit
  # Visually verify: open a member that has a supervisor set — should now show "Direct Manager: First Last" instead of raw UUID
  ```

---

#### Step 10: Frontend MemberCard — add functional manager name display

- **Files:**
  - `frontend/src/components/members/MemberCard.tsx`

- **Changes:**
  1. The card's prop type (lines 9–16) uses `TeamMemberList & { ... }`. Because `TeamMemberList` now includes `functional_manager_name: string | null` (added in Step 7), the card already receives the field from the list response — no prop type widening needed.
  2. After the location block (around lines 113–120), add a functional manager line that renders only when `functional_manager_name` is non-null:
     ```tsx
     {member.functional_manager_name && (
       <div className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400">
         <span className="text-slate-500">FM:</span>
         <span className="truncate">{member.functional_manager_name}</span>
       </div>
     )}
     ```
     The label "FM:" is intentionally terse given card space constraints. If a `UserCheck` or `Network` lucide-react icon is preferred, import it from `lucide-react` and use it in place of the `<span className="text-slate-500">FM:</span>` element.

- **Validation:**
  ```bash
  cd frontend && npx tsc --noEmit
  cd frontend && npx vitest run
  # Visually verify: a member with a functional manager set should show "FM: First Last" below the location line on their card
  ```

---

#### Step 11: Backend tests

- **Files:**
  - `backend/tests/integration/test_org_routes.py` (extend existing file)

- **Changes:**
  Add six new test functions to the existing file, mirroring the pattern of the supervisor tests already there:

  1. `test_set_functional_manager_success` — PUT `/api/org/members/{uuid}/functional-manager` with a valid manager UUID, assert 200 and `functional_manager_id` in response matches the manager UUID.
  2. `test_set_functional_manager_to_null` — set FM then clear it to null, assert `functional_manager_id` is `None`.
  3. `test_set_functional_manager_self_reference_returns_400` — attempt to set member as their own FM, assert 400 and "own functional manager" substring in detail.
  4. `test_set_functional_manager_cycle_returns_400` — set Alice's FM to Bob, then attempt to set Bob's FM to Alice, assert 400 and "circular" substring in detail.
  5. `test_set_functional_manager_member_not_found` — use a zero UUID, assert 404.
  6. `test_detail_response_includes_resolved_supervisor` — create two members, set supervisor, fetch detail via `GET /api/members/{uuid}`, assert the response contains a `supervisor` object with `first_name` and `last_name` (not just `supervisor_id`).

  Each test should use the `client`, `area`, and `db_session` fixtures already available in `conftest.py` at `backend/tests/conftest.py`.

- **Validation:**
  ```bash
  make test
  # Or targeted:
  docker compose exec backend pytest tests/integration/test_org_routes.py -v
  ```

---

#### Step 12: Frontend component tests

- **Files:**
  - `frontend/src/components/members/__tests__/MemberCard.test.tsx` (extend existing file)

- **Changes:**
  Add two new test cases inside the existing `describe('MemberCard', ...)` block:

  1. `it('renders functional manager name when present')` — create a member fixture with `functional_manager_name: 'Bob Smith'`, render the card, assert `screen.getByText('Bob Smith')` is in the document.
  2. `it('does not render functional manager line when functional_manager_name is null')` — create a member fixture with `functional_manager_name: null`, render the card, assert `screen.queryByText('FM:')` is null.

  Update the `baseMember` fixture to include `supervisor_name: null` and `functional_manager_name: null` to match the updated `TeamMemberList` type (TypeScript will require these new required fields).

- **Validation:**
  ```bash
  cd frontend && npx vitest run src/components/members/__tests__/MemberCard.test.tsx
  ```

---

### Risks

1. **`AmbiguousForeignKeysError` at startup** — SQLAlchemy raises this when a self-referencing table has multiple FKs and any relationship omits `foreign_keys=`. Every relationship on `TeamMember` that touches `team_members.uuid` as a remote side must specify `foreign_keys=`. The existing `supervisor` and `direct_reports` relationships already do this. The two new relationships added in Step 2 must also carry `foreign_keys=`. Validate by running `python -c "from app.models.team_member import TeamMember"` — any error appears immediately.

2. **`supervisor_name` / `functional_manager_name` as ORM properties** — Pydantic's `from_attributes=True` will call the model's `supervisor_name` property during serialization. This is only safe when the relationship is already loaded (via `selectinload`). If `list_members` is called from any other code path that does not eager-load these relationships, SQLAlchemy will either raise `MissingGreenlet` in the async context or trigger an implicit lazy load. After Step 4's changes to `list_members`, the relationship is always loaded for list calls. Do not use these properties in code paths that do not eager-load the relationship.

3. **Cycle detection is chain-specific** — `_check_no_cycle` walks `supervisor_id` only. The new `_check_no_functional_cycle` must walk `functional_manager_id`. These are independent DAGs — a cycle through one chain is not detectable by walking the other.

4. **`MemberCard` baseMember fixture in tests** — `TeamMemberList` gains two new required fields (`supervisor_name` and `functional_manager_name`). TypeScript strict mode will reject the existing `baseMember` fixture in `MemberCard.test.tsx` if these fields are absent. Update the fixture in Step 12 before running the test suite, or the test file will fail to compile.

5. **Detail response `supervisor` field name collision** — `TeamMemberDetailResponse` already has a `supervisor_id` field and the model has a `supervisor` relationship. Adding a `supervisor: MemberRefResponse | None = None` Pydantic field alongside `supervisor_id` is safe because Pydantic reads the `supervisor` attribute from the ORM object (the relationship). Confirm this serializes correctly with a manual curl to `GET /api/members/{uuid}` on a member that has a supervisor assigned.

---

### Rollback

1. Run `docker compose exec backend alembic downgrade -1` to drop the `functional_manager_id` column and FK.
2. Revert all file changes in the dependency order (Step 12 → Step 1).
3. The `supervisor_name` and `functional_manager_name` properties on the model are additive and safe to leave temporarily; no data is lost if the migration is rolled back.
