/**
 * Single source of truth for 9-box matrix constants on the frontend.
 *
 * MUST stay in sync with `backend/app/schemas/calibration.py::BOX_LABELS`
 * and `BOX_TO_AXES`. The backend `CalibrationResponse` schema computes
 * `label`, `performance`, and `potential` from the stored `box` column
 * using these mappings — the frontend uses the same mappings to render
 * box numbers, axis labels, and trajectory paths without re-fetching.
 *
 * If you change a label here, change it in `calibration.py` as well.
 */

/** Canonical box number → human-readable label. */
export const BOX_LABELS: Record<number, string> = {
  1: 'Star',
  2: 'High Potential',
  3: 'Enigma',
  4: 'High Professional Plus',
  5: 'Key Performer',
  6: 'Developing Professional',
  7: 'Consistent Star',
  8: 'Reliable Performer',
  9: 'Underperformer',
}

/** Box number → (performance, potential) where each axis is 1=Low, 2=Mid, 3=High. */
export const BOX_TO_AXES: Record<number, [number, number]> = {
  1: [3, 3], 2: [2, 3], 3: [1, 3],
  4: [3, 2], 5: [2, 2], 6: [1, 2],
  7: [3, 1], 8: [2, 1], 9: [1, 1],
}

/** Display labels for the 1/2/3 axis values. */
export const AXIS_LABELS = ['Low', 'Mid', 'High']
