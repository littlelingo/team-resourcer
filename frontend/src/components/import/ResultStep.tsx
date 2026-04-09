import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, RefreshCw, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CommitResult } from '@/api/importApi'
import { resolveAmbiguousCalibrations } from '@/api/calibrationApi'
import { invalidateAllCalibrationViews } from '@/hooks/useCalibrationCycles'

interface ResultStepProps {
  commitResult: CommitResult
  onImportAgain: () => void
}

// ─── Ambiguity Resolve Table ──────────────────────────────────────────────────

type Resolution = { memberUuid: string } | { skip: true }

interface AmbiguousResolveTableProps {
  ambiguousRows: NonNullable<CommitResult['ambiguous_rows']>
  onResolved: (count: number) => void
}

function AmbiguousResolveTable({ ambiguousRows, onResolved }: AmbiguousResolveTableProps) {
  const queryClient = useQueryClient()
  const [resolutions, setResolutions] = useState<Record<number, Resolution>>({})
  const [resolvedRows, setResolvedRows] = useState<Set<number>>(new Set())

  const resolveMutation = useMutation({
    mutationFn: async () => {
      // Group resolutions by cycle_id (one API call per cycle — in practice usually just one)
      const byCycle = new Map<number, Array<{ member_uuid: string; row_data: Record<string, unknown> }>>()
      for (const row of ambiguousRows) {
        const r = resolutions[row.row_index]
        if (!r || 'skip' in r) continue
        const cycleId = row.cycle_id
        if (!byCycle.has(cycleId)) byCycle.set(cycleId, [])
        byCycle.get(cycleId)!.push({ member_uuid: r.memberUuid, row_data: row.row_data })
      }
      if (byCycle.size === 0) throw new Error('No resolutions selected.')
      let createdTotal = 0
      let updatedTotal = 0
      for (const [cycleId, picks] of byCycle) {
        const result = await resolveAmbiguousCalibrations({ cycle_id: cycleId, resolutions: picks })
        createdTotal += result.created_calibrations
        updatedTotal += result.updated_calibrations
      }
      return { created_calibrations: createdTotal, updated_calibrations: updatedTotal }
    },
    onSuccess: (data) => {
      invalidateAllCalibrationViews(queryClient)
      const resolved = new Set<number>()
      ambiguousRows.forEach((row) => {
        const r = resolutions[row.row_index]
        if (r) resolved.add(row.row_index)
      })
      setResolvedRows(resolved)
      const total = (data.created_calibrations ?? 0) + (data.updated_calibrations ?? 0)
      onResolved(total)
    },
  })

  const pendingRows = ambiguousRows.filter((row) => !resolvedRows.has(row.row_index))

  if (pendingRows.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
        <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-600" />
        All ambiguous rows resolved.
      </div>
    )
  }

  const anySelected = Object.keys(resolutions).length > 0

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-amber-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-amber-50 border-b border-amber-200">
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Row</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Name from CSV</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500">Candidate Members</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Skip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100 bg-white">
            {pendingRows.map((row) => {
              const current = resolutions[row.row_index]
              const isSkipped = current && 'skip' in current
              return (
                <tr key={row.row_index}>
                  <td className="px-3 py-2 text-slate-500">{row.row_index}</td>
                  <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">
                    {row.first_name} {row.last_name}
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-1.5">
                      {row.candidates.map((candidate) => {
                        const isSelected =
                          current && !('skip' in current) && current.memberUuid === candidate.uuid
                        return (
                          <label
                            key={candidate.uuid}
                            className="flex items-start gap-2 cursor-pointer"
                          >
                            <input
                              type="radio"
                              name={`row-${row.row_index}`}
                              checked={isSelected ?? false}
                              onChange={() =>
                                setResolutions((prev) => ({
                                  ...prev,
                                  [row.row_index]: { memberUuid: candidate.uuid },
                                }))
                              }
                              className="mt-0.5 h-3 w-3 shrink-0"
                            />
                            <span className="text-slate-700">
                              {candidate.label}
                              {candidate.area && (
                                <span className="text-slate-400"> · {candidate.area}</span>
                              )}
                              {candidate.team && (
                                <span className="text-slate-400"> / {candidate.team}</span>
                              )}
                              {candidate.hire_date && (
                                <span className="text-slate-400"> · hired {candidate.hire_date}</span>
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name={`row-${row.row_index}`}
                        checked={isSkipped ?? false}
                        onChange={() =>
                          setResolutions((prev) => ({
                            ...prev,
                            [row.row_index]: { skip: true },
                          }))
                        }
                        className="h-3 w-3"
                      />
                      <span className="text-slate-500">Skip</span>
                    </label>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {resolveMutation.isError && (
        <p className="text-sm text-red-700">
          {resolveMutation.error instanceof Error
            ? resolveMutation.error.message
            : 'Resolution failed. Please try again.'}
        </p>
      )}

      <button
        onClick={() => resolveMutation.mutate()}
        disabled={!anySelected || resolveMutation.isPending}
        className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {resolveMutation.isPending ? (
          <>
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Resolving…
          </>
        ) : (
          'Resolve ambiguous matches'
        )}
      </button>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ResultStep({ commitResult, onImportAgain }: ResultStepProps) {
  const {
    created_count,
    updated_count,
    skipped_count,
    error_rows,
    created_calibrations,
    updated_calibrations,
    created_cycles,
    unmatched_rows,
    ambiguous_rows,
  } = commitResult

  const isCalibration = created_calibrations !== undefined || updated_calibrations !== undefined

  const [skippedOpen, setSkippedOpen] = useState(false)
  const [unmatchedOpen, setUnmatchedOpen] = useState(false)
  const [resolvedCount, setResolvedCount] = useState(0)

  return (
    <div className="max-w-lg mx-auto py-4">
      {/* ── Success icon ─────────────────────────────────────────────── */}
      <div className="flex flex-col items-center mb-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900">Import Complete</h2>
        <p className="mt-1 text-sm text-slate-500">Your data has been processed successfully.</p>
      </div>

      {/* ── Summary cards ────────────────────────────────────────────── */}
      {isCalibration ? (
        <div className="space-y-2 mb-6">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-green-700">
                {(created_calibrations ?? 0) + resolvedCount}
              </p>
              <p className="mt-0.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Created</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-700">{updated_calibrations ?? 0}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Updated</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-blue-600">{created_cycles ?? 0}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Cycles</p>
            </div>
          </div>
          {((unmatched_rows?.length ?? 0) > 0 || (ambiguous_rows?.length ?? 0) > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
                <p className={`text-2xl font-bold ${(unmatched_rows?.length ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {unmatched_rows?.length ?? 0}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Unmatched</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
                <p className={`text-2xl font-bold ${(ambiguous_rows?.length ?? 0) > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                  {ambiguous_rows?.length ?? 0}
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Ambiguous</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-700">{created_count}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Created</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-slate-700">{updated_count}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Updated</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className={`text-2xl font-bold ${skipped_count > 0 ? 'text-red-600' : 'text-slate-400'}`}>
              {skipped_count}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-500 uppercase tracking-wide">Skipped</p>
          </div>
        </div>
      )}

      {/* ── Ambiguous rows (calibration only) ───────────────────────── */}
      {isCalibration && (ambiguous_rows?.length ?? 0) > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Ambiguous Matches — {ambiguous_rows!.length} row{ambiguous_rows!.length !== 1 ? 's' : ''}
          </h3>
          <p className="text-xs text-slate-500 mb-3">
            Multiple members share this name. Pick the correct person for each row or skip it.
          </p>
          <AmbiguousResolveTable
            ambiguousRows={ambiguous_rows!}
            onResolved={(count) => setResolvedCount((prev) => prev + count)}
          />
        </div>
      )}

      {/* ── Unmatched rows (calibration only) ───────────────────────── */}
      {isCalibration && (unmatched_rows?.length ?? 0) > 0 && (
        <div className="mb-6 rounded-md border border-slate-200 overflow-hidden">
          <button
            onClick={() => setUnmatchedOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            {unmatched_rows!.length} unmatched row{unmatched_rows!.length !== 1 ? 's' : ''} (no member found)
            {unmatchedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {unmatchedOpen && (
            <div className="p-3 space-y-1">
              {unmatched_rows!.map((row) => (
                <p key={row.row_index} className="text-xs text-slate-600">
                  Row {row.row_index}: {row.first_name} {row.last_name}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Skipped rows accordion ───────────────────────────────────── */}
      {error_rows.length > 0 && (
        <div className="mb-6 rounded-md border border-red-200 overflow-hidden">
          <button
            onClick={() => setSkippedOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 bg-red-50 text-sm font-medium text-red-800 hover:bg-red-100 transition-colors"
          >
            View {error_rows.length} skipped row{error_rows.length !== 1 ? 's' : ''}
            {skippedOpen ? (
              <ChevronUp className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronDown className="h-4 w-4 flex-shrink-0" />
            )}
          </button>

          {skippedOpen && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-white border-b border-red-200">
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500">
                      Row
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500">
                      Errors
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100 bg-white">
                  {error_rows.map((row) => (
                    <tr key={row.index}>
                      <td className="px-3 py-2 text-slate-500">{row.index}</td>
                      <td className="px-3 py-2 text-red-700">
                        {row.errors.join('; ')}
                      </td>
                      <td className="px-3 py-2 text-slate-600 font-mono">
                        {Object.entries(row.data)
                          .map(([k, v]) => `${k}: ${String(v ?? '')}`)
                          .join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Actions ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onImportAgain}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <RefreshCw className="h-4 w-4" />
          Import Again
        </button>

        {isCalibration ? (
          <Link
            to="/calibration"
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            View Calibration
          </Link>
        ) : (
          <Link
            to="/members"
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Go to Members
          </Link>
        )}
      </div>
    </div>
  )
}
