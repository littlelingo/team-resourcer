import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as Tooltip from '@radix-ui/react-tooltip'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { commitImport } from '@/api/importApi'
import type { MappedPreviewResult, MappedRow, CommitResult, MappingConfig, EntityType } from '@/api/importApi'
import { memberKeys } from '@/hooks/useMembers'
import { programKeys } from '@/hooks/usePrograms'
import { areaKeys } from '@/hooks/useFunctionalAreas'
import { teamKeys } from '@/hooks/useTeams'
import { agencyKeys } from '@/hooks/useAgencies'

const PAGE_SIZE = 20

interface PreviewStepProps {
  sessionId: string
  columnMap: Record<string, string | null>
  mappedPreview: MappedPreviewResult
  onBack: () => void
  onCommit: (result: CommitResult) => void
  entityType?: EntityType
}

export default function PreviewStep({
  sessionId,
  columnMap,
  mappedPreview,
  onBack,
  onCommit,
  entityType = 'member',
}: PreviewStepProps) {
  const [page, setPage] = useState(0)
  const queryClient = useQueryClient()

  const { rows, error_count } = mappedPreview
  const importableRows = rows.filter((r) => r.errors.length === 0)
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Collect all target field keys that appear in at least one row
  const allColumns = Array.from(
    new Set(rows.flatMap((r) => Object.keys(r.data))),
  ).sort()

  const commitMutation = useMutation({
    mutationFn: () => {
      const config: MappingConfig = { session_id: sessionId, column_map: columnMap, entity_type: entityType }
      return commitImport(config)
    },
    onSuccess: (data) => {
      if (entityType === 'member') {
        queryClient.invalidateQueries({ queryKey: memberKeys.all })
        queryClient.invalidateQueries({ queryKey: programKeys.all })
        queryClient.invalidateQueries({ queryKey: areaKeys.all })
        queryClient.invalidateQueries({ queryKey: teamKeys.all })
      } else if (entityType === 'program') {
        queryClient.invalidateQueries({ queryKey: programKeys.all })
      } else if (entityType === 'area') {
        queryClient.invalidateQueries({ queryKey: areaKeys.all })
      } else if (entityType === 'team') {
        queryClient.invalidateQueries({ queryKey: teamKeys.all })
        queryClient.invalidateQueries({ queryKey: areaKeys.all })
      } else if (entityType === 'agency') {
        queryClient.invalidateQueries({ queryKey: agencyKeys.all })
      } else if (entityType === 'salary_history' || entityType === 'bonus_history' || entityType === 'pto_history') {
        queryClient.invalidateQueries({ queryKey: memberKeys.all })
      }
      onCommit(data)
    },
  })

  return (
    <Tooltip.Provider delayDuration={200}>
      <div>
        {/* ── Summary bar ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
            <span>
              <strong>{importableRows.length}</strong> row{importableRows.length !== 1 ? 's' : ''} ready
            </span>
          </div>
          {error_count > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <span>
                <strong>{error_count}</strong> row{error_count !== 1 ? 's' : ''} have errors
              </span>
            </div>
          )}
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        {allColumns.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-slate-200 mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500 w-8">
                    #
                  </th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500 w-8">
                    Status
                  </th>
                  {allColumns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((row) => (
                  <PreviewRow key={row.index} row={row} columns={allColumns} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            No data to preview.
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mb-6 text-sm text-slate-600">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}

        {commitMutation.isError && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {commitMutation.error instanceof Error
              ? commitMutation.error.message
              : 'Import failed. Please try again.'}
          </div>
        )}

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2 transition-colors"
          >
            Back to Mapping
          </button>

          <button
            onClick={() => commitMutation.mutate()}
            disabled={importableRows.length === 0 || commitMutation.isPending}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {commitMutation.isPending ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Importing...
              </>
            ) : (
              `Import ${importableRows.length} row${importableRows.length !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </Tooltip.Provider>
  )
}

// ─── Preview row ──────────────────────────────────────────────────────────────

function PreviewRow({ row, columns }: { row: MappedRow; columns: string[] }) {
  const hasError = row.errors.length > 0

  return (
    <tr className={cn(hasError && 'opacity-50')}>
      <td className="px-3 py-1.5 text-slate-400">{row.index}</td>
      <td className="px-3 py-1.5">
        {hasError ? (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <AlertCircle className="h-3.5 w-3.5 text-red-500 cursor-help" />
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="right"
                className="z-50 max-w-xs rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
              >
                {row.errors.join('; ')}
                <Tooltip.Arrow className="fill-slate-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : (
          <CheckCircle className="h-3.5 w-3.5 text-green-500" />
        )}
      </td>
      {columns.map((col) => {
        const value = row.data[col]
        const cellError = hasError
        return (
          <td
            key={col}
            className={cn(
              'px-3 py-1.5 whitespace-nowrap',
              cellError ? 'bg-red-50' : 'bg-green-50',
            )}
          >
            {value !== undefined && value !== null ? String(value) : ''}
          </td>
        )
      })}
    </tr>
  )
}
