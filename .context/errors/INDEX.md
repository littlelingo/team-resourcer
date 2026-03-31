# Error Index

Known errors and their resolutions.

| Error | Cause | Fix | Feature |
|-------|-------|-----|---------|
| 422 on `POST /api/areas/{id}/teams/` | `TeamCreate.functional_area_id` is required but frontend omits it (path param injection pattern) | Remove `functional_area_id` from `TeamCreate` schema | 015 |
| Team assignment not shown in member edit form | `add_member_to_team` only sets `team_id`, not `functional_area_id`; edit form scopes teams by member's area | Sync area on assignment OR show all teams in dropdown | 048 |
| MembersPage team filter empty | `useTeams()` called with no areaId returns `[]` | Chain to selected area filter or fetch all teams | 048 |
