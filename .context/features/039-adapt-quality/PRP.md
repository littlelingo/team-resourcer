# PRP: Adapt Code Quality

## Goal
Fix code quality findings from `/adapt` audit.

## Steps

### Step 1: Fix useEffect missing dependency (HIGH)
- File: `frontend/src/pages/trees/ProgramTreePage.tsx:49`
- Add `setEdges` to dependency array

### Step 2: Add response model schemas for untyped routes (MEDIUM)
- File: `backend/app/schemas/team_member.py` — add `ImageUploadResponse`
- File: `backend/app/schemas/team.py` — add `TeamMemberAddResponse`
- File: `backend/app/api/routes/members.py:85` — add `response_model=ImageUploadResponse`
- File: `backend/app/api/routes/teams.py:92` — add `response_model=TeamMemberAddResponse`

### Step 3: Fix email coercion inconsistency (MEDIUM)
- File: `frontend/src/components/members/MemberFormDialog.tsx:168`
- Change `email: values.email || ''` to `email: values.email || undefined`

### Step 4: Fix email validator .match → .fullmatch (MEDIUM)
- File: `backend/app/schemas/team_member.py:48,74`
- Change `_EMAIL_RE.match(v)` to `_EMAIL_RE.fullmatch(v)` in both validators

## Testing Strategy
implement-then-test — run existing test suite after changes.
