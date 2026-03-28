---
name: 020-member-location-split review
description: Key findings from code review of Feature 020 (city + state split) on 2026-03-27
type: project
---

Feature 020 splits `location` VARCHAR into `city`/`state` fields across migration, model, schemas, seed, import, and all frontend components.

**Why:** Reviewed 2026-03-27 at developer's request.

**Key findings:**

CRITICAL:
- `MapColumnsStep.tsx:19` — `MEMBER_TARGET_FIELDS` still has `{ label: 'Location', value: 'location' }`. The backend `import_mapper.py` now lists `city` and `state` as separate accepted fields. A user who maps a source column to `location` will send an unknown key to the backend and silently drop the data. Must be replaced with two entries: `{ label: 'City', value: 'city' }` and `{ label: 'State', value: 'state' }`.
- `MemberCard.test.tsx` — `baseMember` still has `location: 'New York'` typed as `string | null`. `TeamMemberList` no longer has a `location` field so this will produce a TypeScript type error (TS2322) and the test fixture is testing the wrong shape. The two test cases ("renders location", "does not render location when member has no location") are also functionally broken — the component now reads `city`/`state`, not `location`, so the "renders location" test will fail to find 'New York'. Needs to be updated to `city: 'New York', state: null` (or similar).
- `handlers.ts:16` — MSW mock response for `/api/members/` still emits `location: null` instead of `city: null, state: null`. Any test that uses this handler and reads location-related fields from the response will get stale shape. Low blast radius for now but is a type contract violation.

WARNINGS:
- `memberColumns.tsx:97` — The column `id` is still `'location'` (a string identifier, not a field name). This is fine functionally but is a minor naming inconsistency — if anything in the app persists or references column IDs (e.g., column visibility state), the key 'location' will still be used. Acceptable as-is, but worth noting.
- Migration downgrade (line 51-54): `SET location = TRIM(city || ', ' || state)` — in PostgreSQL `||` with a NULL operand returns NULL. If `state` is NULL, `city || ', ' || NULL` is NULL, so the `WHERE city IS NOT NULL AND state IS NOT NULL` guard is correct. However, the second downgrade UPDATE (`SET location = city WHERE city IS NOT NULL AND state IS NULL`) does not run a TRIM, while the upgrade path does `TRIM(location)`. Inconsistent but harmless for most data.

SUGGESTIONS:
- The migration upgrade REVERSE/SPLIT_PART logic is correct for the "City, State" pattern. The edge case of a location with multiple commas (e.g., "Springfield, IL, USA") would set city = "Springfield, IL" and state = "USA" which is semantically odd but unlikely with real data.
- `memberColumns.tsx`: the `'location'` column `id` could be renamed to `'city_state'` in a follow-up to reduce confusion, but it is not load-bearing.

**How to apply:** The missed `MEMBER_TARGET_FIELDS` entry in MapColumnsStep.tsx is the canonical pattern to check whenever a field rename touches the import mapper — always verify the frontend column mapping dropdown is in sync.
