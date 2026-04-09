import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { previewMapping } from '@/api/importApi'
import type { MappedPreviewResult, EntityType, ConstantMapping } from '@/api/importApi'

// ─── Target field definitions ─────────────────────────────────────────────────

export interface TargetField {
  label: string
  value: string
  /** How the value is supplied. 'column' = CSV column, 'constant' = inline text input. Default: 'column'. */
  source?: 'column' | 'constant' | 'column-or-constant'
  required?: boolean
}

// Keep in sync with ENTITY_CONFIGS in backend/app/services/import_mapper.py
export const MEMBER_TARGET_FIELDS: TargetField[] = [
  { label: 'Employee ID', value: 'employee_id' },
  { label: 'First Name', value: 'first_name' },
  { label: 'Last Name', value: 'last_name' },
  { label: 'Hire Date', value: 'hire_date' },
  { label: 'Job Title', value: 'title' },
  { label: 'City', value: 'city' },
  { label: 'State', value: 'state' },
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'Slack Handle', value: 'slack_handle' },
  { label: 'Salary', value: 'salary' },
  { label: 'Bonus', value: 'bonus' },
  { label: 'PTO Used', value: 'pto_used' },
  { label: 'Functional Area', value: 'functional_area_name' },
  { label: 'Team', value: 'team_name' },
  { label: 'Programs (semicolon-separated)', value: 'program_names' },
  { label: 'Program Teams (semicolon-separated)', value: 'program_team_names' },
  { label: 'Program Role (applied to all)', value: 'program_role' },
  { label: 'Supervisor Employee ID', value: 'supervisor_employee_id' },
]

export const PROGRAM_TARGET_FIELDS: TargetField[] = [
  { label: 'Name', value: 'name' },
  { label: 'Description', value: 'description' },
  { label: 'Agency', value: 'agency_name' },
]

export const AREA_TARGET_FIELDS: TargetField[] = [
  { label: 'Name', value: 'name' },
  { label: 'Description', value: 'description' },
]

export const AGENCY_TARGET_FIELDS: TargetField[] = [
  { label: 'Name', value: 'name' },
  { label: 'Description', value: 'description' },
]

export const TEAM_TARGET_FIELDS: TargetField[] = [
  { label: 'Name', value: 'name' },
  { label: 'Functional Area', value: 'functional_area_name' },
  { label: 'Description', value: 'description' },
]

export const SALARY_HISTORY_TARGET_FIELDS: TargetField[] = [
  { label: 'Employee ID', value: 'employee_id' },
  { label: 'Effective Date', value: 'effective_date' },
  { label: 'Amount', value: 'amount' },
  { label: 'Notes', value: 'notes' },
]

export const BONUS_HISTORY_TARGET_FIELDS: TargetField[] = [
  { label: 'Employee ID', value: 'employee_id' },
  { label: 'Effective Date', value: 'effective_date' },
  { label: 'Amount', value: 'amount' },
  { label: 'Notes', value: 'notes' },
]

export const PTO_HISTORY_TARGET_FIELDS: TargetField[] = [
  { label: 'Employee ID', value: 'employee_id' },
  { label: 'Effective Date', value: 'effective_date' },
  { label: 'Amount', value: 'amount' },
  { label: 'Notes', value: 'notes' },
]

// Calibration import fields.
// Fields with source: 'constant' use an inline text input — no CSV column is expected.
// Fields with source: 'column-or-constant' can be mapped from a column OR given a constant.
export const CALIBRATION_TARGET_FIELDS: TargetField[] = [
  { label: 'First Name',                  value: 'first_name',               required: true,  source: 'column' },
  { label: 'Last Name',                   value: 'last_name',                required: true,  source: 'column' },
  { label: 'Cycle Label',                 value: 'cycle_label',              required: true,  source: 'constant' },
  { label: '9-Box Matrix Value',          value: 'box',                      required: true,  source: 'column' },
  { label: 'Effective Date',              value: 'effective_date',           required: true,  source: 'column-or-constant' },
  { label: 'Calibration Reviewers',       value: 'reviewers',                required: false, source: 'column' },
  { label: 'High Growth or Key Talent',   value: 'high_growth_or_key_talent',required: false, source: 'column' },
  { label: 'Ready for Promotion?',        value: 'ready_for_promotion',      required: false, source: 'column' },
  { label: 'Can Mentor Juniors?',         value: 'can_mentor_juniors',       required: false, source: 'column' },
  { label: 'Next Move Recommendation',    value: 'next_move_recommendation', required: false, source: 'column' },
  { label: 'Rationale',                   value: 'rationale',                required: false, source: 'column' },
]

// Auto-suggest: try exact match first, then includes
function suggestField(header: string, fields: TargetField[]): string | null {
  const normalized = header.trim().toLowerCase()
  // Only suggest column-backed fields
  const columnFields = fields.filter((f) => !f.source || f.source === 'column' || f.source === 'column-or-constant')
  const exact = columnFields.find((f) => f.label.toLowerCase() === normalized)
  if (exact) return exact.value
  const exactValue = columnFields.find((f) => f.value.toLowerCase() === normalized)
  if (exactValue) return exactValue.value
  const includes = columnFields.find((f) => f.label.toLowerCase().includes(normalized) || normalized.includes(f.label.toLowerCase()))
  if (includes) return includes.value
  const includesValue = columnFields.find((f) => f.value.toLowerCase().includes(normalized) || normalized.includes(f.value.toLowerCase()))
  if (includesValue) return includesValue.value
  return null
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MapColumnsStepProps {
  sessionId: string
  headers: string[]
  initialColumnMap: Record<string, string | null>
  onPreview: (columnMap: Record<string, string | null>, result: MappedPreviewResult, constantMappings?: ConstantMapping[]) => void
  targetFields?: TargetField[]
  requiredFields?: string[]
  entityType?: EntityType
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function MapColumnsStep({
  sessionId,
  headers,
  initialColumnMap,
  onPreview,
  targetFields = MEMBER_TARGET_FIELDS,
  requiredFields = ['employee_id', 'first_name', 'last_name'],
  entityType = 'member',
}: MapColumnsStepProps) {
  const [columnMap, setColumnMap] = useState<Record<string, string | null>>(() => {
    if (Object.keys(initialColumnMap).length > 0) return initialColumnMap
    const auto: Record<string, string | null> = {}
    for (const header of headers) {
      auto[header] = suggestField(header, targetFields)
    }
    return auto
  })

  // Constant-value state for fields with source: 'constant' or 'column-or-constant'
  const constantFields = targetFields.filter(
    (f) => f.source === 'constant' || f.source === 'column-or-constant',
  )
  const [constantValues, setConstantValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of constantFields) {
      init[f.value] = ''
    }
    return init
  })

  // Re-run auto-suggest if headers change (new upload)
  useEffect(() => {
    if (Object.keys(initialColumnMap).length === 0) {
      const auto: Record<string, string | null> = {}
      for (const header of headers) {
        auto[header] = suggestField(header, targetFields)
      }
      setColumnMap(auto)
    }
  }, [headers, initialColumnMap, targetFields])

  // Build constant_mappings array from non-empty constant values
  function buildConstantMappings(): ConstantMapping[] {
    return constantFields
      .filter((f) => {
        // For column-or-constant: only emit as constant if no column is mapped to this field
        if (f.source === 'column-or-constant') {
          const hasMapped = Object.values(columnMap).includes(f.value)
          return !hasMapped && constantValues[f.value]?.trim()
        }
        return constantValues[f.value]?.trim()
      })
      .map((f) => ({ field: f.value, constant: constantValues[f.value].trim() }))
  }

  const previewMutation = useMutation({
    mutationFn: () => {
      const constantMappings = buildConstantMappings()
      return previewMapping({
        session_id: sessionId,
        column_map: columnMap,
        entity_type: entityType,
        compute_unassignments: false,
        ...(constantMappings.length > 0 ? { constant_mappings: constantMappings } : {}),
      })
    },
    onSuccess: (data) => {
      onPreview(columnMap, data, buildConstantMappings())
    },
  })

  // Required check: column-mapped required fields OR satisfied by a constant
  const hasRequiredFields = requiredFields.every((f) => {
    const inColumn = Object.values(columnMap).includes(f)
    if (inColumn) return true
    const field = targetFields.find((tf) => tf.value === f)
    if (field?.source === 'constant' || field?.source === 'column-or-constant') {
      return constantValues[f]?.trim().length > 0
    }
    return false
  })

  function handleChange(header: string, value: string) {
    setColumnMap((prev) => ({
      ...prev,
      [header]: value === '' ? null : value,
    }))
  }

  // Column-only fields (excluding pure-constant ones from the mapping table)
  const pureConstantFieldValues = new Set(
    targetFields.filter((f) => f.source === 'constant').map((f) => f.value),
  )

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Map Columns</h2>
        <p className="text-sm text-slate-500">
          Match each column from your source file to a target field. Columns set to "Skip" will be ignored.
        </p>
      </div>

      {/* Constant-value fields (e.g. Cycle Label) — shown above the column mapping table */}
      {constantFields.length > 0 && (
        <div className="mb-6 rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Constant Values
          </p>
          <p className="text-xs text-slate-500">
            These values are applied to every row — they are not columns in your CSV file.
          </p>
          <div className="space-y-2">
            {constantFields.map((field) => {
              const isMappedAsColumn =
                field.source === 'column-or-constant' &&
                Object.values(columnMap).includes(field.value)
              return (
                <div key={field.value} className="flex items-center gap-3">
                  <label className="w-44 shrink-0 text-sm font-medium text-slate-700">
                    {field.label}
                    {field.required && <span className="ml-1 text-red-400">*</span>}
                  </label>
                  {isMappedAsColumn ? (
                    <span className="text-xs text-slate-400 italic">
                      (mapped from column — constant ignored)
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={constantValues[field.value] ?? ''}
                      onChange={(e) =>
                        setConstantValues((prev) => ({
                          ...prev,
                          [field.value]: e.target.value,
                        }))
                      }
                      placeholder={
                        field.value === 'cycle_label'
                          ? 'e.g. 2026 Q1'
                          : field.value === 'effective_date'
                            ? 'e.g. 2026-03-31'
                            : 'Enter constant value'
                      }
                      className="flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-md border border-slate-200 overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-1/2">
                Source Column
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-1/2">
                Maps To
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {headers.map((header) => (
              <tr key={header} className="bg-white hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5">
                  <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                    {header}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <select
                    value={columnMap[header] ?? ''}
                    onChange={(e) => handleChange(header, e.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  >
                    <option value="">Skip this column</option>
                    {/* Exclude pure-constant fields from the dropdown — they are always constant */}
                    {targetFields
                      .filter((f) => !pureConstantFieldValues.has(f.value))
                      .map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!hasRequiredFields && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Map at least {requiredFields.map((f, i) => (
            <span key={f}>{i > 0 && ' and '}<strong>{targetFields.find((t) => t.value === f)?.label ?? f}</strong></span>
          ))} to continue.
        </p>
      )}

      {previewMutation.isError && (
        <div className="mb-4 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-sm text-red-700">
            {previewMutation.error instanceof Error
              ? previewMutation.error.message
              : 'Preview failed. Please try again.'}
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => previewMutation.mutate()}
          disabled={!hasRequiredFields || previewMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          {previewMutation.isPending ? (
            <>
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Generating Preview...
            </>
          ) : (
            'Preview'
          )}
        </button>
      </div>
    </div>
  )
}
