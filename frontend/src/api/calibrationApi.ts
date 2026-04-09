import { apiFetch } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalibrationCycle {
  id: number
  label: string
  sequence_number: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface Calibration {
  id: number
  member_uuid: string
  cycle_id: number
  box: number
  reviewers: string | null
  high_growth_or_key_talent: string | null
  ready_for_promotion: string | null
  can_mentor_juniors: string | null
  next_move_recommendation: string | null
  rationale: string | null
  effective_date: string
  created_at: string
  updated_at: string
  cycle: CalibrationCycle
  // computed
  label: string
  performance: number
  potential: number
}

export interface CalibrationLatestRow extends Calibration {
  // same shape — included for semantic clarity in the visualization layer
}

export interface CalibrationMovementRow {
  member_uuid: string
  from_box: number
  to_box: number
}

export interface CalibrationTrendPoint {
  cycle_id: number
  cycle_label: string
  box: number
  count: number
}

export interface AmbiguousRowCandidate {
  uuid: string
  label: string
  area: string
  team: string
  hire_date: string
}

export interface AmbiguousRow {
  row_index: number
  first_name: string
  last_name: string
  candidates: AmbiguousRowCandidate[]
  row_data: Record<string, unknown>
}

export interface CalibrationCreate {
  cycle_id: number
  box: number
  effective_date: string
  reviewers?: string
  high_growth_or_key_talent?: string
  ready_for_promotion?: string
  can_mentor_juniors?: string
  next_move_recommendation?: string
  rationale?: string
}

export interface CalibrationUpdate {
  box?: number
  effective_date?: string
  reviewers?: string
  high_growth_or_key_talent?: string
  ready_for_promotion?: string
  can_mentor_juniors?: string
  next_move_recommendation?: string
  rationale?: string
}

export interface ResolveAmbiguousRequest {
  cycle_id: number
  resolutions: Array<{ member_uuid: string; row_data: Record<string, unknown> }>
}

export interface ResolveAmbiguousResult {
  created_calibrations: number
  updated_calibrations: number
}

// ─── Calibration Cycles ───────────────────────────────────────────────────────

export function fetchCycles(): Promise<CalibrationCycle[]> {
  return apiFetch<CalibrationCycle[]>('/api/calibration-cycles/')
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export function fetchLatestCalibrations(params?: {
  area_id?: number
  team_id?: number
  program_id?: number
  cycle_id?: number
}): Promise<CalibrationLatestRow[]> {
  const search = params
    ? '?' +
      new URLSearchParams(
        Object.fromEntries(
          Object.entries(params)
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, String(v)]),
        ),
      ).toString()
    : ''
  return apiFetch<CalibrationLatestRow[]>(`/api/calibrations/latest${search}`)
}

export function fetchMovement(
  fromCycleId: number,
  toCycleId: number,
): Promise<CalibrationMovementRow[]> {
  return apiFetch<CalibrationMovementRow[]>(
    `/api/calibrations/movement?from=${fromCycleId}&to=${toCycleId}`,
  )
}

export function fetchTrends(cycles = 8): Promise<CalibrationTrendPoint[]> {
  return apiFetch<CalibrationTrendPoint[]>(`/api/calibrations/trends?cycles=${cycles}`)
}

// ─── Per-member ───────────────────────────────────────────────────────────────

export function fetchMemberCalibrations(memberUuid: string): Promise<Calibration[]> {
  return apiFetch<Calibration[]>(`/api/members/${memberUuid}/calibrations/`)
}

export function createCalibration(
  memberUuid: string,
  data: CalibrationCreate,
): Promise<Calibration> {
  return apiFetch<Calibration>(`/api/members/${memberUuid}/calibrations/`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateCalibration(
  memberUuid: string,
  calibrationId: number,
  data: CalibrationUpdate,
): Promise<Calibration> {
  return apiFetch<Calibration>(`/api/members/${memberUuid}/calibrations/${calibrationId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteCalibration(memberUuid: string, calibrationId: number): Promise<void> {
  return apiFetch<void>(`/api/members/${memberUuid}/calibrations/${calibrationId}`, {
    method: 'DELETE',
  })
}

// ─── Resolve ambiguous ────────────────────────────────────────────────────────

export function resolveAmbiguousCalibrations(
  payload: ResolveAmbiguousRequest,
): Promise<ResolveAmbiguousResult> {
  return apiFetch<ResolveAmbiguousResult>('/api/calibrations/resolve-ambiguous', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
