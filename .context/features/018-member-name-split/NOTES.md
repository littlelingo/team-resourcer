# Feature 018 — Member Name Split: Research Notes

## 1. Backend Model

**File:** `backend/app/models/team_member.py`

The "Member" entity is the `TeamMember` class mapped to the `team_members` table. There is no standalone `member.py` model file.

**Relevant field:**
- Line 30: `name: Mapped[str] = mapped_column(String(255), nullable=False)` — a single `name` column, no `first_name`/`last_name` split

**All fields on `TeamMember`:**
| Column | Type | Nullable |
|---|---|---|
| `uuid` | UUID (PK) | No |
| `employee_id` | String(50), unique | No |
| `name` | String(255) | No |
| `title` | String(255) | Yes |
| `location` | String(255) | Yes |
| `image_path` | String(500) | Yes |
| `email` | String(255) | Yes |
| `phone` | String(50) | Yes |
| `slack_handle` | String(100) | Yes |
| `salary` | Numeric(12,2) | Yes |
| `bonus` | Numeric(12,2) | Yes |
| `pto_used` | Numeric(6,2) | Yes |
| `functional_area_id` | FK → functional_areas.id | No |
| `team_id` | FK → teams.id | Yes |
| `supervisor_id` | FK → team_members.uuid | Yes |
| `created_at` | DateTime(tz) | No |
| `updated_at` | DateTime(tz) | No |

---

## 2. Backend Pydantic Schemas

**File:** `backend/app/schemas/team_member.py`

**`TeamMemberCreate` (lines 18–46):**
- Required: `employee_id`, `name`, `functional_area_id`
- Optional: `title`, `location`, `email`, `phone`, `slack_handle`, `salary`, `bonus`, `pto_used`, `team_id`, `supervisor_id`
- Has validators: `employee_id_not_empty`, `validate_email_format`

**`TeamMemberUpdate` (lines 49–68):**
- All optional: same fields as Create except `employee_id` and `functional_area_id` are also optional here
- Has `validate_email_format` validator

**`TeamMemberListResponse` (lines 71–83):**
- Omits: `phone`, `salary`, `bonus`, `pto_used`, `supervisor_id`, timestamps

**`TeamMemberDetailResponse` (lines 86–109):**
- Full set including nested `functional_area`, `team`, `program_assignments`, `history`

---

## 3. Backend API Routes

**File:** `backend/app/api/routes/members.py`

| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/api/members/` | `list_members_route` | Filters: `program_id`, `area_id`, `team_id` |
| GET | `/api/members/{uuid}` | `get_member_route` | Returns `TeamMemberDetailResponse` |
| POST | `/api/members/` | `create_member_route` | Body: `TeamMemberCreate` |
| PUT | `/api/members/{uuid}` | `update_member_route` | Body: `TeamMemberUpdate` |
| DELETE | `/api/members/{uuid}` | `delete_member_route` | 204 No Content |
| POST | `/api/members/{uuid}/image` | `upload_image_route` | Multipart form file upload |

---

## 4. Frontend TypeScript Types

**File:** `frontend/src/types/index.ts`

**`TeamMemberList` (lines 77–88):** Lightweight list shape; `name` is a single string field (line 80)

**`TeamMember extends TeamMemberList` (lines 90–105):** Full detail shape; adds `phone`, `salary`, `bonus`, `pto_used`, `supervisor_id`, nested `functional_area`, `team`, `program_assignments`, `history`, timestamps

**`MemberFormInput` (lines 109–123):** Form input type; `name` is a single `string` field (line 111)

---

## 5. Frontend Form

**File:** `frontend/src/components/members/MemberFormDialog.tsx`

**Zod schema (`memberFormSchema`, lines 21–35):** Includes `name: z.string().min(1, 'Name is required')` as a single field.

**Form fields rendered (in order):**
1. Photo (ImageUpload)
2. Employee ID + Name (side by side, 2-col grid) — lines 254–269
3. Title
4. Email + Phone (side by side)
5. Slack Handle + Location (side by side)
6. Functional Area + Team (side by side, cascading: team filtered by area)
7. Supervisor (SelectField from all members minus self)
8. Salary + Bonus + PTO Used (3-col grid)

**Name field specifics (lines 262–268):**
```tsx
<Field label="Name" required error={errors.name?.message}>
  <input
    {...register('name')}
    className={inputCls}
    placeholder="Full name"
  />
</Field>
```
Single text input, placeholder "Full name", placed in a 2-col grid next to Employee ID.

**Submit logic (lines 123–188):** On create calls `createMember.mutateAsync`; on edit calls `updateMember.mutateAsync`. Both pass `name: values.name` directly.

---

## 6. Frontend Display

### Card view
**File:** `frontend/src/components/members/MemberCard.tsx`

- Avatar fallback (line 82–84): calls `getInitials(member.name)` from `frontend/src/lib/member-utils.ts`
- Name displayed (line 87–89): `<h3>{member.name}</h3>`
- Title displayed below name if present

### Table view
**File:** `frontend/src/components/members/memberColumns.tsx`

- "Member" column (lines 28–57): Avatar + `member.name` in bold, `member.title` in muted text below

### Name utilities
**File:** `frontend/src/lib/member-utils.ts`

```ts
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
```
Splits on whitespace: single word → first 2 chars; multiple words → first char of first + first char of last word.

### Detail sheet
**File:** `frontend/src/components/members/MemberDetailSheet.tsx` — not yet fully read; likely also renders `member.name` directly.

### Page filter
**File:** `frontend/src/pages/MembersPage.tsx` (lines 83–92): Client-side search filters on `m.name`, `m.email`, `m.title`.

---

## 7. Import Support

**File:** `backend/app/services/import_mapper.py`

Member import `target_fields` (lines 33–49):
```
employee_id, name, title, location, email, phone,
slack_handle, salary, bonus, pto_used,
functional_area_name, team_name, program_name,
supervisor_employee_id, program_role
```
- `name` is a required field (`required_fields={"employee_id", "name"}`, line 50)
- Dedup field is `employee_id` (line 53)
- `salary`, `bonus`, `pto_used` are validated as numeric

If splitting `name` into `first_name`/`last_name`, the import target fields and required fields must be updated here, and a derived `name` must be assembled in `import_commit.py`.

---

## 8. Database Migrations

**File:** `backend/alembic/versions/452ccece7038_initial_schema.py`

Initial migration (lines 54–80) creates `team_members` with:
- `name VARCHAR(255) NOT NULL` (line 59)

**File:** `backend/alembic/versions/b514fc596e17_add_agencies_and_program_agency_fk.py`
- Adds agency entity and `programs.agency_id` FK; does not touch `team_members`

A new migration would be required to add `first_name`/`last_name` columns (and optionally drop or retain `name`).

---

## 9. Seed Data

**File:** `backend/app/seed.py`

Three seeded members with full-name `name` strings (lines 83–138):
- `"Alice Johnson"` (E001)
- `"Bob Smith"` (E002)
- `"Carol Williams"` (E003)

If the schema splits `name`, seed data must supply `first_name`/`last_name` instead of (or in addition to) `name`.

---

## Summary of Touch Points for a Name Split

A feature that splits `name` into `first_name` + `last_name` across the full stack must update:

| Layer | File | Change |
|---|---|---|
| DB model | `backend/app/models/team_member.py:30` | Replace `name` with `first_name`/`last_name` (or add columns) |
| Migration | New Alembic version | ADD `first_name`, `last_name`; migrate data; DROP `name` or keep as generated |
| Pydantic Create | `backend/app/schemas/team_member.py:19-20` | Replace `name: str` with `first_name`, `last_name` |
| Pydantic Update | `backend/app/schemas/team_member.py:50-51` | Same |
| Pydantic Read (both) | `backend/app/schemas/team_member.py:73,90` | Expose new fields; may also expose computed `name` |
| TS types | `frontend/src/types/index.ts:80,111` | Replace `name` with `first_name`/`last_name`; add computed `name` or derive inline |
| Form dialog | `frontend/src/components/members/MemberFormDialog.tsx:23,262–268` | Two inputs (or keep one for display); update Zod schema and submit payload |
| Member utils | `frontend/src/lib/member-utils.ts` | `getInitials` must handle `first_name`/`last_name` params |
| Card display | `frontend/src/components/members/MemberCard.tsx:87` | Render combined name |
| Table columns | `frontend/src/components/members/memberColumns.tsx:49` | Same |
| Page search | `frontend/src/pages/MembersPage.tsx:87` | Search on `first_name`, `last_name` or computed `name` |
| Import mapper | `backend/app/services/import_mapper.py:33-50` | Replace/add `first_name`, `last_name` target fields; update required fields |
| Import commit | `backend/app/services/import_commit.py` | Assemble member from `first_name`/`last_name` |
| Seed data | `backend/app/seed.py:86,107,128` | Supply split name values |
