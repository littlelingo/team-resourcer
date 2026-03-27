# 019 — Member Form Layout Adjustment

## Goal
Rearrange fields on the Add/Edit Member form dialog so that:
- **First Name + Last Name** share one row
- **Hire Date + Employee ID** share one row

## Current State

**File**: `frontend/src/components/members/MemberFormDialog.tsx`

Current field layout (lines 262–300):
| Row | Fields | Grid |
|-----|--------|------|
| 1 | Photo | full width |
| 2 | Employee ID + First Name | `grid-cols-2 gap-3` |
| 3 | Last Name | full width |
| 4 | Hire Date | full width |
| 5 | Title | full width |
| 6 | Email + Phone | `grid-cols-2 gap-3` |
| ... | ... | ... |

### Desired Layout
| Row | Fields | Grid |
|-----|--------|------|
| 1 | Photo | full width |
| 2 | First Name + Last Name | `grid-cols-2 gap-3` |
| 3 | Hire Date + Employee ID | `grid-cols-2 gap-3` |
| 4 | Title | full width |
| 5 | Email + Phone | `grid-cols-2 gap-3` |
| ... | ... | ... |

## Key Details
- **UI Framework**: Tailwind CSS 3.4, inline utility classes
- **Grid pattern**: `grid grid-cols-2 gap-3` already used for side-by-side fields in same file
- **Field wrapper**: `Field` component (`shared/Field.tsx`) — works cleanly in grid columns
- **Dialog width**: `max-w-lg` (~512px), so grid-cols-2 gives ~230px per field — adequate for these fields

## Changes Required
1. Move First Name out of the Employee ID row
2. Put First Name + Last Name in a `grid grid-cols-2 gap-3` row
3. Put Hire Date + Employee ID in a `grid grid-cols-2 gap-3` row
4. Remove the standalone Last Name and Hire Date rows

## Risks
- Minimal — purely cosmetic layout change using existing patterns
- Date picker may be slightly narrower in a 2-col layout, but same constraint already works for other paired fields

## Open Questions
- None — straightforward layout rearrangement
