---
name: project_054_team_lead_badge_review
description: 054-team-lead-badge (amber Lead badge in EntityMembersSheet, optional leadId prop): key findings from review on 2026-04-03
type: project
---

Adds amber "Lead" badge in EntityMembersSheet next to the lead's name. Optional `leadId?: string | null` prop; other callers (ProgramsPage, FunctionalAreasPage) unaffected.

Key findings:
- `leadId && member.uuid === leadId` guard correctly handles null/undefined without badge rendering. Short-circuit on null/undefined is safe because empty-string leadId is falsy and would also be suppressed — consistent with intent.
- `Team.lead_id` is `string | null` and `TeamMemberList.uuid` is `string` — same type, `===` comparison is safe.
- `selectedTeam?.lead_id` uses optional chaining, so when no team is selected (null) the prop receives `undefined`, which is also handled correctly by the `leadId &&` guard.
- Badge uses `flex-shrink-0` correctly: prevents badge from collapsing when name is long. Name `p` element retains `truncate` so overflow is handled.
- Amber color (`bg-amber-100 text-amber-700`) is consistent with TeamNode's amber palette (`border-amber-200 bg-amber-50 text-amber-700 text-amber-900`).
- One minor UX gap: the lead can still be removed via the trash icon while badged as Lead. No UI affordance prevents this, though the backend may still allow it (no blocker).
- No tests added. Testing strategy is implement-then-test, not tests-optional, but this is a pure presentational change — low risk.
- Lead removed from team edge case: `lead_id` stays on the team row until the lead assignment is explicitly cleared elsewhere. If a lead is removed from the members list but `lead_id` is not cleared on the team object, the badge would simply not render (the UUID won't match any member in the list) — silent and correct.

**Why:** Feature adds lead visibility to members sheet to match lead visibility already on TeamNode in tree views.
**How to apply:** If EntityMembersSheet gains a programLead or areaLead concept in the future, the same optional-prop pattern is the established pattern.
