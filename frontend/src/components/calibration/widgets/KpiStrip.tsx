import { cn } from '@/lib/utils'
import { useLatestCalibrations } from '@/hooks/useCalibrations'
import { useCalibrationFilters } from '../CalibrationFilterContext'

// Verbatim values that indicate "yes" for boolean-ish flags
const YES_PATTERNS = /^(yes|ready|true|1)$/i

function countYesLike(values: Array<string | null>): number {
  return values.filter((v) => v && YES_PATTERNS.test(v.trim())).length
}

function countNonEmpty(values: Array<string | null>): number {
  return values.filter((v) => v && v.trim().toLowerCase() !== 'no' && v.trim() !== '').length
}

interface KpiTileProps {
  label: string
  value: string | number
  sub?: string
  accent?: string
}

function KpiTile({ label, value, sub, accent = 'text-slate-900' }: KpiTileProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 min-w-[100px]">
      <p className="text-xs text-slate-500 truncate">{label}</p>
      <p className={cn('mt-1 text-xl font-bold', accent)}>{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  )
}

interface KpiStripProps {
  totalMembers?: number
  className?: string
}

export default function KpiStrip({ totalMembers, className }: KpiStripProps) {
  const { areaId, teamId, programId, cycleId } = useCalibrationFilters()
  const { data: calibrations = [], isLoading } = useLatestCalibrations({
    area_id: areaId,
    team_id: teamId,
    program_id: programId,
    cycle_id: cycleId,
  })

  if (isLoading) {
    return (
      <div className={cn('flex gap-3', className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 w-28 animate-pulse rounded-lg bg-slate-100" />
        ))}
      </div>
    )
  }

  const n = calibrations.length
  const topThree = calibrations.filter((c) => c.box <= 3).length
  const bottomRow = calibrations.filter((c) => c.box >= 7).length
  const coverage = totalMembers && totalMembers > 0
    ? `${Math.round((n / totalMembers) * 100)}%`
    : `${n}`

  const readyForPromo = countYesLike(calibrations.map((c) => c.ready_for_promotion))
  const highGrowth = countNonEmpty(calibrations.map((c) => c.high_growth_or_key_talent))
  const mentors = countYesLike(calibrations.map((c) => c.can_mentor_juniors))

  const pct = (count: number) => (n > 0 ? `${Math.round((count / n) * 100)}%` : '—')

  return (
    <div className={cn('flex flex-wrap gap-3', className)}>
      <KpiTile
        label="In Top 3 Boxes"
        value={pct(topThree)}
        sub={`${topThree} members`}
        accent="text-emerald-600"
      />
      <KpiTile
        label="In Bottom Row"
        value={pct(bottomRow)}
        sub={`${bottomRow} members`}
        accent={bottomRow > 0 ? 'text-red-500' : 'text-slate-900'}
      />
      <KpiTile
        label="Calibration Coverage"
        value={coverage}
        sub={totalMembers ? `of ${totalMembers} members` : `calibrated`}
      />
      <KpiTile
        label="Ready for Promotion"
        value={pct(readyForPromo)}
        sub={`${readyForPromo} members`}
        accent="text-blue-600"
      />
      <KpiTile
        label="High Growth / Key Talent"
        value={pct(highGrowth)}
        sub={`${highGrowth} flagged`}
        accent="text-amber-600"
      />
      <KpiTile
        label="Mentor Capacity"
        value={pct(mentors)}
        sub={`${mentors} can mentor`}
        accent="text-violet-600"
      />
    </div>
  )
}
