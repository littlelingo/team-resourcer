import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import type { CommitResult } from '@/api/importApi'

interface ResultStepProps {
  commitResult: CommitResult
  onImportAgain: () => void
}

export default function ResultStep({ commitResult, onImportAgain }: ResultStepProps) {
  const { created_count, updated_count, skipped_count, error_rows } = commitResult
  const [skippedOpen, setSkippedOpen] = useState(false)

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

        <Link
          to="/members"
          className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          Go to Members
        </Link>
      </div>
    </div>
  )
}
