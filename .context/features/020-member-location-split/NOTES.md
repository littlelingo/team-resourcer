# 020 — Member Location Split (city + state)

## Goal
Split the single `location` VARCHAR field into separate `city` and `state` fields. The import source provides these as two separate columns. The UI should continue displaying them combined (e.g., "Austin, TX") — only the storage and import mapping change.

## Current State

### Database / Model
- **Column**: `location: VARCHAR(255), nullable=True` on `team_members` table
- **Model**: `backend/app/models/team_member.py:34` — `Mapped[str | None]`
- **Initial migration**: `452ccece7038` created the column; untouched since

### Backend Schemas
- `backend/app/schemas/team_member.py` — `location: str | None = None` in all four schemas:
  - `TeamMemberCreate` (line 24)
  - `TeamMemberUpdate` (line 56)
  - `TeamMemberListResponse` (line 83)
  - `TeamMemberDetailResponse` (line 100)

### Import Logic
- `backend/app/services/import_mapper.py:42-65` — `"location"` is a valid target field for member entity
- `backend/app/services/import_commit.py:295-307` — `location` in `scalar_fields` list, written as-is from CSV

### Frontend Types
- `frontend/src/types/index.ts:83` — `TeamMemberList`: `location: string | null`
- `frontend/src/types/index.ts:117` — `MemberFormInput`: `location?: string`

### Frontend Form
- `frontend/src/components/members/MemberFormDialog.tsx`
  - Zod schema (line 30): `location: z.string()`
  - Default (line 95): `location: member?.location ?? ''`
  - Input field (lines 326-333): text input with placeholder "City, Country"
  - Submit (lines 140, 165): `location: values.location || undefined`

### Frontend Display (keep as-is visually)
- `MemberCard.tsx:112-118` — MapPin icon + `member.location` text
- `MemberDetailSheet.tsx:133-138` — MapPin icon + `member.location` in Contact section
- `memberColumns.tsx:97-108` — "Location" sortable column in table view

## Changes Required

### Backend
1. **New migration**: Drop `location` column, add `city VARCHAR(255)` and `state VARCHAR(100)` columns (both nullable)
2. **Data migration**: Convert existing `location` values — attempt to parse "City, State" format into separate fields
3. **Model update**: Replace `location` with `city` and `state` mapped columns
4. **Schema update**: Replace `location` with `city` and `state` in all four Pydantic schemas. Add a computed `location` property or include both fields in responses.
5. **Import mapper**: Replace `"location"` target field with `"city"` and `"state"` as separate mappable fields
6. **Import commit**: Update `scalar_fields` list — replace `"location"` with `"city"` and `"state"`

### Frontend
7. **Types**: Replace `location` with `city` and `state` in `TeamMemberList` and `MemberFormInput`
8. **Form**: Replace single location input with two inputs (city + state), update Zod schema, defaults, submit payload
9. **Display components**: Update MemberCard, MemberDetailSheet, and memberColumns to compose display from `city` + `state` (e.g., `[city, state].filter(Boolean).join(', ')`)

## Risks
- **Data migration**: Existing `location` values may not follow "City, State" format consistently — need a best-effort parser with fallback (put entire value in `city` if unparseable)
- **Import column mapping**: Existing saved import mappings (if any) that reference `"location"` will break — need to handle gracefully
- **Form UX**: Two fields instead of one — slightly more complex but more structured

## Open Questions
- Should `state` be a free-text field or a dropdown of US state abbreviations? (Assuming free-text for flexibility with international locations)
- Should the API response include a computed `location` string for backwards compatibility, or just return `city` and `state` separately?
