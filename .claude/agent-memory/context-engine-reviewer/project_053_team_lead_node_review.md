---
name: project_053_team_lead_node_review
description: 053-team-lead-node (show team lead on team node, remove duplicate member node): key findings from review on 2026-04-02
type: project
---

Show team lead name on TeamNode and suppress duplicate member node for the lead. Team node becomes clickable when lead_id is present.

Key findings:
- `lead_team_map` scoping is correct: dual-condition check (uuid in map AND team_id matches) correctly handles lead of Team A who is also a regular member of Team B.
- `team.lead_id` is `uuid.UUID` and `member.uuid` is `uuid.UUID` — same Python type, dict lookup is safe.
- `team.id` is `int` and `member.team_id` is `int | None` — int == int comparison safe; None case excluded by `uuid in lead_team_map` guard.
- TeamNode click guard (`isClickable`) is correct and matches intent, but diverges from MemberNode pattern: MemberNode uses unconditional `onClick` with optional chaining (`data.onSelect?.()`), while TeamNode uses conditional `onClick={isClickable ? handleClick : undefined}`. Both are functionally safe.
- `onSelect` is always injected for both member and team nodes in AreaTreePage, regardless of whether team has a lead. TeamNode handles this correctly via `isClickable` check.
- Missing test coverage: no test for lead exclusion (lead of Team A still appears as member of Team B), no test for team node `lead_id` in tree response data.

**Why:** Feature adds team lead visibility to area tree and eliminates duplicate node for leads.
**How to apply:** If tree_service exclusion logic is revisited, remember the dual-condition is intentional and necessary for cross-team lead membership.
