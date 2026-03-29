# Research: Functional Manager + Direct Report Rename

## Current State

The `team_members` table has a single self-referencing FK: `supervisor_id → team_members.uuid`.
The model exposes two sides of this relationship:
- `supervisor` (the member's own supervisor — the "parent" side)
- `direct_reports` (members who report to this member — the "children" side)

The terminology throughout the backend calls the parent role "supervisor" and the child role "direct reports". The feature wants to:
1. Add a **second** self-referencing FK — `functional_manager_id` — representing a separate reporting chain (functional vs. administrative).
2. Rename the "supervisor" label on the UI to "Direct Report" is **ambiguous in the request** — see Open Questions. Based on the description ("inverting the relationship semantics"), this likely means renaming what is currently displayed as "Supervisor" to instead surface the member's *direct reports* list, and the new `functional_manager_id` takes the former "who supervises this person" role. Alternatively it may mean the label "Supervisor" is renamed to "Direct Manager" or similar. See Open Questions.
3. Display functional manager on the member card UI (currently the card shows no supervisor data at all — it only shows area, programs, location).

---

## Backend

### Model
**File:** `backend/app/models/team_member.py`

Current self-referencing FK (lines 47–51):
```python
supervisor_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("team_members.uuid"),
    nullable=True,
)
```

Current relationships (lines 80–90):
```python
supervisor: Mapped[TeamMember | None] = relationship(
    "TeamMember",
    back_populates="direct_reports",
    foreign_keys=[supervisor_id],
    remote_side="TeamMember.uuid",
)
direct_reports: Mapped[list[TeamMember]] = relationship(
    "TeamMember",
    back_populates="supervisor",
    foreign_keys="TeamMember.supervisor_id",
)
```

Adding `functional_manager_id` follows the exact same pattern. SQLAlchemy requires explicit `foreign_keys=` on both sides whenever there are multiple self-referencing FKs on the same table.

New column to add:
```python
functional_manager_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("team_members.uuid"),
    nullable=True,
)
```

New relationships to add:
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

### Schemas
**File:** `backend/app/schemas/team_member.py`

`TeamMemberCreate` (line 34): `supervisor_id: UUID | None = None`
`TeamMemberUpdate` (line 67): `supervisor_id: UUID | None = None`
`TeamMemberDetailResponse` (line 114): `supervisor_id: UUID | None`

New field `functional_manager_id: UUID | None = None` must be added to all three schemas.

`TeamMemberDetailResponse` currently **does not** expose a resolved `supervisor` object — only the raw `supervisor_id` UUID. If the UI needs to show the functional manager's name (not just their UUID), a `functional_manager: TeamMemberListResponse | None` nested field is needed. Currently MemberDetailSheet.tsx shows the supervisor as a raw UUID (line 155: `<span className="font-mono text-xs">{member.supervisor_id}</span>`), which is a poor UX. This feature is a good opportunity to fix both.

**File:** `backend/app/schemas/org.py`

`SupervisorUpdate` (line 21) only covers `supervisor_id`. A parallel `FunctionalManagerUpdate` schema will be needed if a dedicated set-functional-manager endpoint is added (following the same pattern as the existing `/api/org/members/{uuid}/supervisor` route).

### Service
**File:** `backend/app/services/member_service.py`

`get_member` (line 60): loads `selectinload(TeamMember.supervisor)`. Needs `selectinload(TeamMember.functional_manager)` added.

`create_member` and `update_member`: supervisor_id flows through the generic `data.model_dump()` / `update_data` pattern — no special handling needed beyond adding the field to the schemas. Functional manager follows the same path.

`_FINANCIAL_FIELDS` (line 17) is not affected.

**File:** `backend/app/services/org_service.py`

`set_supervisor` (lines 49–71): handles self-reference guard and cycle detection for the supervisor chain. A parallel `set_functional_manager` function is needed with the same guards, operating on `functional_manager_id`.

`get_org_tree` / `_build_tree` (lines 16–46): builds the tree using `direct_reports` (supervisor chain). This is unaffected unless a second functional org tree is also desired.

**File:** `backend/app/services/import_supervisor.py`

`resolve_supervisors` (line 27): resolves `supervisor_employee_id` column during import commit. If CSV import of functional manager is needed, a parallel resolver or an extended version of this function is required. The import target field `supervisor_employee_id` (mapper line 72) would gain a sibling `functional_manager_employee_id`.

### Routes
**File:** `backend/app/api/routes/org.py`

Existing dedicated supervisor endpoint (line 25):
```
PUT /api/org/members/{member_uuid}/supervisor
Body: { supervisor_id: UUID | null }
```

A parallel endpoint would be:
```
PUT /api/org/members/{member_uuid}/functional-manager
Body: { functional_manager_id: UUID | null }
```

**File:** `backend/app/api/routes/members.py`

Standard CRUD routes — no changes needed beyond schema additions flowing through automatically.

### Migration
**Current head:** `d8e2f3a4c501` (`member_location_split`)

New migration needed:
```python
op.add_column("team_members", sa.Column(
    "functional_manager_id", sa.UUID(), nullable=True
))
op.create_foreign_key(
    "fk_team_members_functional_manager_id",
    "team_members", "team_members",
    ["functional_manager_id"], ["uuid"],
)
```

The initial migration (`452ccece7038`) shows the supervisor FK was created inline without a named constraint. For consistency, the new FK can follow the same pattern or use a named constraint (safer for downgrade).

---

## Frontend

### Member Card
**File:** `frontend/src/components/members/MemberCard.tsx`

The card currently shows: avatar, name, title, functional area badge, program assignment badges, city/state. It does **not** display supervisor or any relationship data. To show "Functional Manager" on the card, a new text line or badge needs to be added.

The card's prop type is `TeamMemberList & { functional_area?: ...; program_assignments?: ... }` (lines 9–16). `TeamMemberList` does not include `supervisor_id` or `functional_manager_id` — those are only on the full `TeamMember` detail type. To display functional manager name on the card, the card either needs to:
- Accept the resolved manager name as an extra prop (preferred — avoids deep type widening), or
- Be upgraded to use the full `TeamMember` type

### Member Form
**File:** `frontend/src/components/members/MemberFormDialog.tsx`

Supervisor field (lines 380–393): a `SelectField` populated from `allMembers` filtered to exclude self. The field value is `supervisor_id` (UUID string).

A second `SelectField` for `functional_manager_id` follows the same pattern. The options list will also need to exclude self and can reuse the same `allMembers` query.

Zod schema (line 34): `supervisor_id: z.string()`. A new `functional_manager_id: z.string()` field needs to be added.

Default values (line 101): `supervisor_id: member?.supervisor_id ?? ''`. Same pattern for `functional_manager_id`.

Submit handler (lines 150, 174): `supervisor_id: values.supervisor_id || undefined`. Same for functional manager.

### Member Detail Sheet
**File:** `frontend/src/components/members/MemberDetailSheet.tsx`

Organization section (lines 133–168): currently shows supervisor as raw UUID (line 155). This is an existing UX gap independent of this feature.

With this feature: a "Functional Manager" row should appear in the Organization section. If the API returns a resolved `functional_manager` object (not just the UUID), the name can be displayed directly. Otherwise a second UUID display is equally poor.

### Types
**File:** `frontend/src/types/index.ts`

`TeamMember` (lines 92–108): needs `functional_manager_id: string | null` added alongside `supervisor_id` (line 101).

`MemberFormInput` (lines 112–129): needs `functional_manager_id?: string` added.

If the detail response is extended to include a resolved `functional_manager` object, the type also needs:
```typescript
functional_manager?: { uuid: string; first_name: string; last_name: string } | null
```

---

## Gaps & Dependencies

| Layer | Change Required |
|-------|----------------|
| DB migration | Add `functional_manager_id` UUID nullable column + FK to `team_members.uuid` |
| Model | Add column + two relationships (`functional_manager`, `functional_reports`) with explicit `foreign_keys=` |
| Schemas — Create/Update | Add `functional_manager_id: UUID | None = None` to `TeamMemberCreate` and `TeamMemberUpdate` |
| Schemas — Detail Response | Add `functional_manager_id: UUID | None` (and optionally a resolved `functional_manager` object) |
| Schemas — org.py | Add `FunctionalManagerUpdate` schema |
| Service — member_service | Add `selectinload(TeamMember.functional_manager)` in `get_member` |
| Service — org_service | Add `set_functional_manager` function with self-ref and cycle guards |
| Route — org.py | Add `PUT /api/org/members/{uuid}/functional-manager` endpoint |
| Import mapper | Optionally add `functional_manager_employee_id` to `target_fields` |
| Import supervisor resolver | Optionally add parallel resolver for functional manager import |
| Frontend types | Add `functional_manager_id` to `TeamMember` and `MemberFormInput` |
| MemberFormDialog | Add second supervisor-style `SelectField` for functional manager |
| MemberDetailSheet | Add "Functional Manager" row in Organization section |
| MemberCard | Add functional manager display (requires type widening or extra prop) |
| Tests — backend | New integration tests for `set_functional_manager` (self-ref, cycle, null clear) |
| Tests — frontend | Update MemberCard and MemberFormDialog tests |

---

## Risks

**Multiple self-referencing FKs on the same table:** SQLAlchemy requires explicit `foreign_keys=` on every relationship that touches a self-referencing table when there is more than one such FK. Forgetting this will cause an `AmbiguousForeignKeysError` at startup. The existing supervisor relationships already set `foreign_keys=` correctly, so the pattern is established — but both new relationships must also set it.

**Cycle detection is per-chain:** The existing `_check_no_cycle` in org_service.py walks the `supervisor_id` chain only. The functional manager chain is a separate DAG — a member could be their own functional manager through an indirect chain involving a different set of members. The cycle guard for `set_functional_manager` must walk `functional_manager_id`, not `supervisor_id`.

**Import CSV backward compatibility:** If `supervisor_employee_id` is not renamed in the mapper, existing CSV imports keep working. The new `functional_manager_employee_id` can be additive. However, the "rename supervisor to direct report" aspect of the feature may imply renaming the import column too — this needs product clarification before touching the import layer.

**MemberCard type mismatch:** `MemberCard` uses `TeamMemberList` (the lightweight list shape) which does not carry `supervisor_id` or relationship data. Showing functional manager on the card requires either passing the resolved name as a separate prop from the parent page, or switching the card to use the full `TeamMember` detail type (which requires the list endpoint to return the extra field or an additional fetch per card — likely unacceptable).

**Supervisor ID displayed as raw UUID:** The detail sheet currently shows `supervisor_id` as a hex UUID (line 155), not a name. The functional manager should not repeat this mistake. The preferred fix is to have the backend detail response include a resolved `functional_manager: { uuid, first_name, last_name }` object, and update supervisor to the same pattern at the same time.

---

## Open Questions

1. **What does "rename supervisor to direct report" mean exactly?**
   The description says "inverting the relationship semantics." There are two possible interpretations:
   - (a) The *label* "Supervisor" in the UI is renamed to "Direct Manager" or "Line Manager" and the field keeps the same semantic (who this person reports to).
   - (b) The UI stops showing who *supervises* this member, and instead shows the list of people who *report to* this member (the `direct_reports` list), relabeled as "Direct Reports."
   Interpretation (a) is simpler and does not break the data model. Interpretation (b) is a significant UI restructuring. Clarify with the requester before implementation.

2. **Should the org tree (`/api/org/tree`) be extended to also show the functional reporting chain?** The current tree is built entirely from `supervisor_id`. A functional org chart would need a separate endpoint or a combined response shape.

3. **Should functional manager be settable via the CSV import flow?** If yes, add `functional_manager_employee_id` to the mapper's `target_fields` and a parallel resolver. If not, it is form-only.

4. **Should the functional manager relationship also enforce cycle detection across the combined supervisor + functional manager graph?** (e.g., Alice is Bob's supervisor, Bob is Alice's functional manager — is that a cycle?) Current cycle detection is per-chain. The answer depends on org policy.

5. **Does the `MemberCard` in the list view need to show functional manager?** Given the card's lightweight type, this would require a design decision about either widening the list API response or passing resolved names down from the parent.
