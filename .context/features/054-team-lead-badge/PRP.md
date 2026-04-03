# PRP: Team Lead Badge in Members Sheet

## Status: COMPLETE

## Testing Strategy: implement-then-test

## Context
When viewing team members via EntityMembersSheet, there was no visual indicator for the team lead. Added amber "Lead" badge using optional `leadId` prop.

## Steps
- [x] Step 1: Add `leadId` prop to EntityMembersSheet; render "Lead" badge when `member.uuid === leadId`
- [x] Step 2: Pass `leadId={selectedTeam?.lead_id}` from TeamsPage

## Files
- `frontend/src/components/shared/EntityMembersSheet.tsx`
- `frontend/src/pages/TeamsPage.tsx`

## Verification
- [x] Frontend tests pass (135/135)
- [x] Backend tests pass (175/175)
- [x] Code review: APPROVED (0 critical)
- [x] Manual: badge appears on lead, absent on non-leads and other entity sheets

## Review Notes
- Warning: removing lead from member list doesn't clear `lead_id` on team — UX gap, not data corruption. Badge silently disappears. Consider follow-up.
