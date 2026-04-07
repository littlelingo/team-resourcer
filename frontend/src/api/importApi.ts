import { apiFetch } from '@/lib/api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadResponse {
  session_id: string
  headers: string[]
  preview_rows: Record<string, unknown>[]
  total_row_count: number
}

// Keep in sync with EntityType in backend/app/schemas/import_schemas.py
export type EntityType = 'member' | 'program' | 'area' | 'team' | 'agency' | 'salary_history' | 'bonus_history' | 'pto_history'

export interface MappingConfig {
  session_id: string
  column_map: Record<string, string | null>
  entity_type?: EntityType
  compute_unassignments?: boolean
}

export interface MappedRow {
  index: number
  data: Record<string, unknown>
  errors: string[]
  warnings: string[]
  unassignments?: string[]
}

export interface MappedPreviewResult {
  rows: MappedRow[]
  error_count: number
  warning_count: number
}

export interface CommitResult {
  created_count: number
  updated_count: number
  skipped_count: number
  error_rows: MappedRow[]
}

// ─── API Functions ────────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  return apiFetch<UploadResponse>('/api/import/upload', {
    method: 'POST',
    body: formData,
  })
}

export async function fetchGoogleSheet(sheetUrlOrId: string): Promise<UploadResponse> {
  return apiFetch<UploadResponse>('/api/import/google-sheets', {
    method: 'POST',
    body: JSON.stringify({ sheet_url_or_id: sheetUrlOrId }),
  })
}

export async function previewMapping(config: MappingConfig): Promise<MappedPreviewResult> {
  return apiFetch<MappedPreviewResult>('/api/import/preview', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

export async function commitImport(config: MappingConfig): Promise<CommitResult> {
  return apiFetch<CommitResult>('/api/import/commit', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}
