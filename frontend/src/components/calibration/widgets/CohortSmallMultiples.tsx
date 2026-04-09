import { useLatestCalibrations } from '@/hooks/useCalibrations'
import { useCalibrationFilters } from '../CalibrationFilterContext'
import MiniNineBox from './MiniNineBox'
import { cn } from '@/lib/utils'
import type { CalibrationLatestRow } from '@/api/calibrationApi'

const COHORT_CAP = 12

interface CohortSmallMultiplesProps {
  className?: string
}

export default function CohortSmallMultiples({ className }: CohortSmallMultiplesProps) {
  const { areaId, teamId, programId, cycleId } = useCalibrationFilters()
  const { data: calibrations = [], isLoading } = useLatestCalibrations({
    area_id: areaId,
    team_id: teamId,
    program_id: programId,
    cycle_id: cycleId,
  })

  if (isLoading) {
    return <div className={cn('animate-pulse rounded-lg bg-slate-50 h-64', className)} />
  }

  if (calibrations.length === 0) {
    return (
      <div className={cn('flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400', className)}>
        Import calibration data to see cohort comparison.
      </div>
    )
  }

  // Group by dimension — for now we use a simple approach since we only have cycle data
  // The calibrations don't carry area/team info in this shape, so we group all together
  // as a single cohort labeled "All Members" until member detail is attached
  const groups: Array<{ label: string; cals: CalibrationLatestRow[] }> = [
    { label: 'All Members', cals: calibrations },
  ]

  const display = groups.slice(0, COHORT_CAP)

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-xs text-slate-500">
        Showing {display.length} cohort{display.length !== 1 ? 's' : ''} (cap: {COHORT_CAP})
      </p>
      <div className="flex flex-wrap gap-4">
        {display.map((group) => (
          <MiniNineBox
            key={group.label}
            calibrations={group.cals}
            title={group.label}
          />
        ))}
      </div>
    </div>
  )
}
