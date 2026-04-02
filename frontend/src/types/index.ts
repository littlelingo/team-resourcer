// ─── Functional Areas ────────────────────────────────────────────────────────

export interface FunctionalArea {
  id: number
  name: string
  description: string | null
}

// ─── Agencies ────────────────────────────────────────────────────────────────

export interface Agency {
  id: number
  name: string
  description: string | null
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

export interface ProgramAssignment {
  member_uuid: string
  program_id: number
  role: string | null
  program?: ProgramListItem
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
}

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
