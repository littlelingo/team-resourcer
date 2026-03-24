import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { previewMapping } from '@/api/importApi'
import type { MappedPreviewResult } from '@/api/importApi'

// ─── Target field definitions ─────────────────────────────────────────────────

const TARGET_FIELDS: { label: string; value: string }[] = [
  { label: 'Employee ID', value: 'employee_id' },
  { label: 'Full Name', value: 'name' },
  { label: 'Job Title', value: 'title' },
  { label: 'Location', value: 'location' },
  { label: 'Email', value: 'email' },
  { label: 'Phone', value: 'phone' },
  { label: 'Slack Handle', value: 'slack_handle' },
  { label: 'Salary', value: 'salary' },
  { label: 'Bonus', value: 'bonus' },
  { label: 'PTO Used', value: 'pto_used' },
  { label: 'Functional Area', value: 'functional_area_name' },
  { label: 'Team', value: 'team_name' },
  { label: 'Program', value: 'program_name' },
  { label: 'Program Role', value: 'program_role' },
  { label: 'Supervisor Employee ID', value: 'supervisor_employee_id' },
]

// Auto-suggest: try exact match first, then includes
function suggestField(header: string): string | null {
  const normalized = header.trim().toLowerCase()
  // Exact match against label
  const exact = TARGET_FIELDS.find((f) => f.label.toLowerCase() === normalized)
  if (exact) return exact.value
  // Exact match against value
  const exactValue = TARGET_FIELDS.find((f) => f.value.toLowerCase() === normalized)
  if (exactValue) return exactValue.value
  // Includes match against label
  const includes = TARGET_FIELDS.find((f) => f.label.toLowerCase().includes(normalized) || normalized.includes(f.label.toLowerCase()))
  if (includes) return includes.value
  // Includes match against value
  const includesValue = TARGET_FIELDS.find((f) => f.value.toLowerCase().includes(normalized) || normalized.includes(f.value.toLowerCase()))
  if (includesValue) return includesValue.value
  return null
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MapColumnsStepProps {
  sessionId: string
  headers: string[]
  initialColumnMap: Record<string, string | null>
  onPreview: (columnMap: Record<string, string | null>, result: MappedPreviewResult) => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function MapColumnsStep({
  sessionId,
  headers,
  initialColumnMap,
  onPreview,
}: MapColumnsStepProps) {
  const [columnMap, setColumnMap] = useState<Record<string, string | null>>(() => {
    // If we have an existing map from wizard state, use it; otherwise auto-suggest
    if (Object.keys(initialColumnMap).length > 0) return initialColumnMap
    const auto: Record<string, string | null> = {}
    for (const header of headers) {
      auto[header] = suggestField(header)
    }
    return auto
  })

  // Re-run auto-suggest if headers change (new upload)
  useEffect(() => {
    if (Object.keys(initialColumnMap).length === 0) {
      const auto: Record<string, string | null> = {}
      for (const header of headers) {
        auto[header] = suggestField(header)
      }
      setColumnMap(auto)
    }
  }, [headers, initialColumnMap])

  const previewMutation = useMutation({
    mutationFn: () => previewMapping({ session_id: sessionId, column_map: columnMap }),
    onSuccess: (data) => {
      onPreview(columnMap, data)
    },
  })

  // Required: employee_id and name must be mapped
  const hasRequiredFields =
    Object.values(columnMap).includes('employee_id') &&
    Object.values(columnMap).includes('name')

  function handleChange(header: string, value: string) {
    setColumnMap((prev) => ({
      ...prev,
      [header]: value === '' ? null : value,
    }))
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-slate-900 mb-1">Map Columns</h2>
        <p className="text-sm text-slate-500">
          Match each column from your source file to a member field. Columns set to "Skip" will be ignored.
        </p>
      </div>

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
                    {TARGET_FIELDS.map((field) => (
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
          Map at least <strong>Employee ID</strong> and <strong>Name</strong> to continue.
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
