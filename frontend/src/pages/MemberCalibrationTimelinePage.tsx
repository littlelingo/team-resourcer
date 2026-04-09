import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useCalibrationHistory } from '@/hooks/useCalibrationHistory'
import { useMember } from '@/hooks/useMembers'
import { cn } from '@/lib/utils'
import type { Calibration } from '@/api/calibrationApi'

const BOX_COLORS: Record<number, string> = {
  1: 'bg-emerald-600 text-white',
  2: 'bg-emerald-500 text-white',
  3: 'bg-yellow-500 text-white',
  4: 'bg-emerald-400 text-white',
  5: 'bg-blue-500 text-white',
  6: 'bg-yellow-400 text-white',
  7: 'bg-blue-400 text-white',
  8: 'bg-slate-400 text-white',
  9: 'bg-red-400 text-white',
}

function computeTrendSummary(history: Calibration[]) {
  if (history.length === 0) return null
  const n = history.length
  // history is sorted newest-first from API
  const oldest = history[n - 1]
  const newest = history[0]
  const delta = oldest.box - newest.box // lower box = better, so negative = moved up
  const direction = delta < 0 ? 'up' : delta > 0 ? 'down' : 'flat'
  return { n, delta: Math.abs(delta), direction, oldest, newest }
}

export default function MemberCalibrationTimelinePage() {
  const { uuid } = useParams<{ uuid: string }>()
  const { data: member, isLoading: memberLoading } = useMember(uuid ?? '')
  const { data: history = [], isLoading: historyLoading } = useCalibrationHistory(uuid ?? '')

  const isLoading = memberLoading || historyLoading
  const trend = computeTrendSummary(history)

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          to="/members"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to members
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">
          {member
            ? `${member.first_name} ${member.last_name} — Calibration History`
            : 'Calibration History'}
        </h1>
        {member?.title && (
          <p className="mt-1 text-sm text-slate-500">{member.title}</p>
        )}
      </div>

      {isLoading && (
        <div className="text-sm text-slate-400">Loading...</div>
      )}

      {/* Trend summary */}
      {!isLoading && trend && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 flex items-center gap-4">
          <div className="flex items-center gap-2">
            {trend.direction === 'up' && <TrendingUp className="h-5 w-5 text-emerald-500" />}
            {trend.direction === 'down' && <TrendingDown className="h-5 w-5 text-red-400" />}
            {trend.direction === 'flat' && <Minus className="h-5 w-5 text-slate-400" />}
            <span className="text-sm font-medium text-slate-700">
              {trend.n} {trend.n === 1 ? 'cycle' : 'cycles'}
            </span>
          </div>
          <span className="text-slate-300">|</span>
          <span className="text-sm text-slate-600">
            {trend.direction === 'flat'
              ? 'No net movement'
              : `Net ${trend.direction === 'up' ? '+' : '-'}${trend.delta} box${trend.delta !== 1 ? 'es' : ''} (trending ${trend.direction})`}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-sm text-slate-500">
            Box {trend.oldest.box} → Box {trend.newest.box}
          </span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && history.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center">
          <p className="text-sm text-slate-500">First calibration coming soon.</p>
          <p className="mt-1 text-xs text-slate-400">
            Import calibration data to populate this member's history.
          </p>
        </div>
      )}

      {/* Timeline */}
      {!isLoading && history.length > 0 && (
        <ol className="relative border-l-2 border-slate-200 space-y-6 pl-6">
          {history.map((cal, i) => {
            const prev = history[i + 1]
            const boxDelta = prev ? prev.box - cal.box : null
            const moved =
              boxDelta !== null
                ? boxDelta < 0
                  ? 'up'
                  : boxDelta > 0
                    ? 'down'
                    : 'same'
                : null

            return (
              <li key={cal.id} className="relative">
                {/* Timeline dot — box badge */}
                <span
                  className={cn(
                    'absolute -left-[3.25rem] top-0 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold shadow-sm',
                    BOX_COLORS[cal.box] ?? 'bg-slate-500 text-white',
                  )}
                >
                  {cal.box}
                </span>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-medium text-slate-900">{cal.label}</p>
                      <p className="text-xs text-slate-500">
                        {cal.cycle.label} · {new Date(cal.effective_date).toLocaleDateString()}
                      </p>
                    </div>
                    {moved && moved !== 'same' && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                          moved === 'up'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700',
                        )}
                      >
                        {moved === 'up' ? '↑' : '↓'}
                        {Math.abs(boxDelta!)} box{Math.abs(boxDelta!) !== 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>

                  {/* Flags */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {cal.ready_for_promotion && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                        Promo: {cal.ready_for_promotion}
                      </span>
                    )}
                    {cal.can_mentor_juniors && (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">
                        Mentor: {cal.can_mentor_juniors}
                      </span>
                    )}
                    {cal.high_growth_or_key_talent && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                        Growth: {cal.high_growth_or_key_talent}
                      </span>
                    )}
                  </div>

                  {/* Rationale */}
                  {cal.rationale && (
                    <p className="text-sm text-slate-600 italic">&ldquo;{cal.rationale}&rdquo;</p>
                  )}

                  {/* Next move */}
                  {cal.next_move_recommendation && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Next move: {cal.next_move_recommendation}
                    </p>
                  )}

                  {/* Reviewers */}
                  {cal.reviewers && (
                    <p className="mt-1 text-xs text-slate-400">Reviewers: {cal.reviewers}</p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
