import { Group } from '@visx/group'
import { Bar } from '@visx/shape'
import { scaleBand, scaleLinear } from '@visx/scale'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { cn } from '@/lib/utils'
import { useLatestCalibrations } from '@/hooks/useCalibrations'
import { useCalibrationFilters } from '../CalibrationFilterContext'

// Box layout: performance axis (column): 1=low, 2=mid, 3=high
//             potential axis (row):       1=low, 2=mid, 3=high
const BOX_TO_AXES: Record<number, [number, number]> = {
  1: [3, 3], 2: [2, 3], 3: [1, 3],
  4: [3, 2], 5: [2, 2], 6: [1, 2],
  7: [3, 1], 8: [2, 1], 9: [1, 1],
}

const AXIS_LABELS = ['Low', 'Mid', 'High']

interface MarginalBarsProps {
  className?: string
}

export default function MarginalBars({ className }: MarginalBarsProps) {
  const { areaId, teamId, programId, cycleId } = useCalibrationFilters()
  const { data: calibrations = [], isLoading } = useLatestCalibrations({
    area_id: areaId,
    team_id: teamId,
    program_id: programId,
    cycle_id: cycleId,
  })

  if (isLoading) {
    return <div className={cn('animate-pulse rounded-lg bg-slate-50 h-32', className)} />
  }

  if (calibrations.length === 0) return null

  // Aggregate performance and potential counts
  const perfCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  const potCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 }

  for (const cal of calibrations) {
    const [perf, pot] = BOX_TO_AXES[cal.box] ?? [0, 0]
    if (perf) perfCounts[perf] = (perfCounts[perf] ?? 0) + 1
    if (pot) potCounts[pot] = (potCounts[pot] ?? 0) + 1
  }

  const perfData = [1, 2, 3].map((v) => ({ label: AXIS_LABELS[v - 1], value: perfCounts[v] }))
  const potData = [1, 2, 3].map((v) => ({ label: AXIS_LABELS[v - 1], value: potCounts[v] }))

  const width = 200
  const barHeight = 80
  const margin = { top: 8, right: 8, bottom: 24, left: 32 }
  const innerW = width - margin.left - margin.right
  const innerH = barHeight - margin.top - margin.bottom

  const maxVal = Math.max(...perfData.map((d) => d.value), ...potData.map((d) => d.value), 1)

  const xScale = scaleBand({ range: [0, innerW], padding: 0.3, domain: AXIS_LABELS })
  const yScale = scaleLinear({ range: [innerH, 0], domain: [0, maxVal] })

  function BarChart({
    data,
    fill,
    label,
  }: {
    data: Array<{ label: string; value: number }>
    fill: string
    label: string
  }) {
    return (
      <div>
        <p className="text-xs text-center font-medium text-slate-500 mb-1">{label}</p>
        <svg width={width} height={barHeight + margin.top + margin.bottom}>
          <Group left={margin.left} top={margin.top}>
            {data.map((d) => {
              const bw = xScale.bandwidth()
              const x = xScale(d.label) ?? 0
              const bh = Math.max(innerH - (yScale(d.value) ?? 0), 0)
              const y = innerH - bh
              return (
                <Bar
                  key={d.label}
                  x={x}
                  y={y}
                  width={bw}
                  height={bh}
                  fill={fill}
                  rx={2}
                />
              )
            })}
            <AxisBottom
              scale={xScale}
              top={innerH}
              stroke="transparent"
              tickStroke="transparent"
              tickLabelProps={{ fontSize: 10, fill: '#94a3b8', textAnchor: 'middle' }}
            />
            <AxisLeft
              scale={yScale}
              numTicks={3}
              stroke="transparent"
              tickStroke="transparent"
              tickLabelProps={{ fontSize: 9, fill: '#94a3b8', textAnchor: 'end' }}
            />
          </Group>
        </svg>
      </div>
    )
  }

  return (
    <div className={cn('flex gap-4 items-end', className)}>
      <BarChart data={perfData} fill="#3b82f6" label="Performance" />
      <BarChart data={potData} fill="#10b981" label="Potential" />
    </div>
  )
}
