---
name: Research: Calibration Entity (9-box matrix)
description: 2026-04-08 pre-planning research for adding a member-attached Calibration entity with 9-box placement, CSV import, detail view section, and visualization page
type: project
---

Full research findings captured in conversation on 2026-04-08.

**Why:** New feature request for 9-box performance×potential calibration data attached to members.

**How to apply:** Use MemberHistory (EAV, 1:many) as closest model for the child entity pattern. Import must use name-based member lookup (first+last) since no employee_id in calibration CSV. See conversation summary for all file paths and risk flags.
