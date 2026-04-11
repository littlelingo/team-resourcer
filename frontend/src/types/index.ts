// ─── Functional Areas ────────────────────────────────────────────────────────

export interface FunctionalArea {
  id: number
  name: string
  description: string | null
  member_count: number
}

// ─── Agencies ────────────────────────────────────────────────────────────────

export interface Agency {
  id: number
  name: string
  description: string | null
  member_count: number
}

// ─── Teams ───────────────────────────────────────────────────────────────────

/** Lightweight team reference embedded in member responses */
export interface TeamListItem {
  id: number
  name: string
  functional_area_id: number
}

export interface Team {
  id: number
  name: string
  description: string | null
  functional_area_id: number
  lead_id: string | null
  functional_area?: FunctionalArea
  member_count: number
  created_at: string
  updated_at: string
}

// ─── Programs ────────────────────────────────────────────────────────────────

/** Lightweight program reference embedded in assignment responses */
export interface ProgramListItem {
  id: number
  name: string
}

export interface Program {
  id: number
  name: string
  description: string | null
  agency_id: number | null
  agency?: Agency
  member_count: number
  created_at: string
  updated_at: string
}

export interface ProgramTeamListItem {
  id: number
  name: string
  program_id: number
}

export interface ProgramAssignment {
  member_uuid: string
  program_id: number
  role: string | null
  program?: ProgramListItem
  program_team?: ProgramTeamListItem | null
}

// ─── Member History ───────────────────────────────────────────────────────────

export interface MemberHistory {
  id: number
  member_uuid: string
  field: string
  /** Financial values come as string decimals from the backend e.g. "120000.00" */
  value: string
  effective_date: string
  notes: string | null
  created_at: string
}

// ─── Team Members ─────────────────────────────────────────────────────────────

export interface TeamMemberList {
  uuid: string
  employee_id: string
  first_name: string
  last_name: string
  title: string | null
  city: string | null
  state: string | null
  image_path: string | null
  email: string
  slack_handle: string | null
  functional_area_id: number | null
  team_id: number | null
  supervisor_name: string | null
  functional_manager_name: string | null
  functional_area?: FunctionalArea | null
  team?: TeamListItem | null
  program_assignments?: ProgramAssignment[]
  latest_calibration?: CalibrationBrief | null
}

// ─── Calibration ─────────────────────────────────────────────────────────────

export interface CalibrationBrief {
  box: number
  cycle_id: number
  label: string
  performance: number
  potential: number
}

export interface CalibrationCycleEmbed {
  id: number
  label: string
  sequence_number: number
  start_date: string | null
  end_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
}

export interface CalibrationEmbed {
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
  cycle: CalibrationCycleEmbed
  /** Computed on the backend */
  label: string
  performance: number
  potential: number
}

// ─── Team Members ─────────────────────────────────────────────────────────────

export interface TeamMember extends TeamMemberList {
  phone: string | null
  /** Salary as string decimal e.g. "120000.00" */
  salary: string | null
  /** Bonus as string decimal e.g. "15000.00" */
  bonus: string | null
  /** PTO used as string decimal e.g. "40.00" */
  pto_used: string | null
  hire_date: string | null
  supervisor_id: string | null
  functional_manager_id: string | null
  supervisor?: { uuid: string; first_name: string; last_name: string } | null
  functional_manager?: { uuid: string; first_name: string; last_name: string } | null
  functional_area?: FunctionalArea
  team?: TeamListItem
  program_assignments?: ProgramAssignment[]
  history?: MemberHistory[]
  calibrations?: CalibrationEmbed[]
  latest_calibration?: CalibrationEmbed | null
  created_at: string
  updated_at: string
}

// ─── Form Input Types ─────────────────────────────────────────────────────────

export interface MemberFormInput {
  employee_id: string
  first_name: string
  last_name: string
  hire_date?: string
  title?: string
  city?: string
  state?: string
  email: string
  slack_handle?: string
  phone?: string
  salary?: string
  bonus?: string
  pto_used?: string
  supervisor_id?: string
  functional_manager_id?: string
  functional_area_id?: number
  team_id?: number
}

export interface ProgramFormInput {
  name: string
  description?: string
  agency_id?: number
}

export interface AgencyFormInput {
  name: string
  description?: string
}

export interface FunctionalAreaFormInput {
  name: string
  description?: string
}

export interface TeamFormInput {
  name: string
  description?: string
  lead_id?: string
}

export interface ProgramAssignmentFormInput {
  program_id: number
  role?: string
}
