# Error Index

Known errors and their resolutions.

| Error | Cause | Fix | Feature |
|-------|-------|-----|---------|
| 422 on `POST /api/areas/{id}/teams/` | `TeamCreate.functional_area_id` is required but frontend omits it (path param injection pattern) | Remove `functional_area_id` from `TeamCreate` schema | 015 |
| Team assignment not shown in member edit form | `add_member_to_team` only sets `team_id`, not `functional_area_id`; edit form scopes teams by member's area | Sync area on assignment OR show all teams in dropdown | 048 |
| MembersPage team filter empty | `useTeams()` called with no areaId returns `[]` | Chain to selected area filter or fetch all teams | 048 |
| MissingGreenlet on list endpoint after adding nested schema field | Pydantic accesses relationship during serialization; if not eager-loaded in async session, SQLAlchemy raises `MissingGreenlet` | Add `selectinload` for every relationship declared in the response schema — check ALL routes using the schema | 050 |
| Member list missing functional_area/team/programs | `TeamMemberListResponse` only declared flat IDs, not nested objects; Pydantic strips unregistered fields | Add nested fields to list response schema; ensure all service functions eager-load them | 050 |
| EntityMembersSheet not refreshing after assign/unassign | `useAssignProgram`/`useUnassignProgram` only invalidated `programKeys.all`, not `programKeys.members(id)` | Add `programKeys.members(programId)` to `onSuccess` invalidation | 046/047 |
| Area member_count stale after add/remove | `onAdd`/`onRemove` in FunctionalAreasPage only refetched area members sheet, not the areas list | Add `areaKeys.all` invalidation in `onSuccess` callbacks | 047 |
| Program diff in form submit bypasses cache | `useMemberForm` used raw `apiFetch` for program assign/unassign instead of mutation hooks | Add manual `programKeys.members(id)` invalidation after diff loop | 046 |
