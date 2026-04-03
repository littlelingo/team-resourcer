---
name: 052-entity-member-count review
description: 052-entity-member-count (member_count for agencies/areas/teams, set comprehension dedup, embedded schema default): key findings from review on 2026-04-02
type: project
---

## Key Findings (2026-04-02)

### Correctness
- All service functions for team, area, and agency (list, get, create, update) have selectinload + attribute injection. MissingGreenlet risk is fully mitigated.
- `create_team` delegates to `get_team` (correct — already has members selectinload).
- `update_team` calls `get_team` twice: once for the existence/area_id check in the router, and once inside `update_team` which also calls `get_team`. This is a triple-fetch on the happy path (router pre-check + update_team's internal get_team pre-mutation check + final re-query). No correctness issue, but worth noting.
- `update_agency` calls `get_agency` (which does selectinload+_set_member_count), then after commit does another selectinload+_set_member_count re-query. Double-fetch on update — no-op result, same as feature 051 pattern.
- `create_agency` does `db.refresh` then an explicit re-query. The `db.refresh` is unnecessary before the re-query (same as feature 051).

### Agency Deduplication
- Set comprehension `{a.member_uuid for p in agency.programs for a in p.assignments}` is correct.
- Handles empty programs list (empty set → len = 0).
- Deduplicates members assigned to multiple programs under same agency.

### Embedded Schema Impact
- `FunctionalAreaListResponse` is embedded in `TeamMemberListResponse`, `TeamMemberDetailResponse`, and `TeamResponse`. These are served from member_service and team_service, NOT area_service. The `FunctionalArea` ORM object embedded there does NOT go through `list_areas`/`get_area`, so `member_count` will be absent on the ORM model in that path — the `= 0` default in the schema correctly handles this without error.
- `AgencyListResponse` is embedded in `ProgramResponse`. Same pattern — agency loaded via program_service's selectinload(Program.agency), not agency_service. The `= 0` default handles it correctly.
- No serialization errors will occur; the default is load-bearing here.

### Pattern Consistency
- Follows the feature 051 pattern exactly: dynamic attribute injection via `# type: ignore[attr-defined]`, selectinload in all response-returning paths, `= 0` schema default for embedded use.
- `_set_member_count` helper for agency is a minor improvement in DRY vs. inline assignment in area/team services.

**Why:** Review on commit 0658c49 for feature 052.
**How to apply:** The `= 0` schema default pattern is intentionally load-bearing for embedded entity contexts where the service layer does not inject the attribute. This is expected and correct — do not flag it as a bug in future reviews.
