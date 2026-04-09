import { useState } from 'react'
import { Group } from '@visx/group'
import { LinePath } from '@visx/shape'
import { scaleLinear, scaleBand } from '@visx/scale'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { cn } from '@/lib/utils'
import { useCalibrationTrends } from '@/hooks/useCalibrationTrends'

const BOX_COLORS: Record<number, string> = {
  1: '#059669', 2: '#10b981', 3: '#d97706',
  4: '#34d399', 5: '#3b82f6', 6: '#fbbf24',
  7: '#60a5fa', 8: '#94a3b8', 9: '#f87171',
}

interface CycleTrendLinesProps {
  className?: string
}

export default function CycleTrendLines({ className }: CycleTrendLinesProps) {
  const { data: trends = [], isLoading } = useCalibrationTrends(8)
  const [mode, setMode] = useState<'absolute' | 'percent'>('absolute')

  if (isLoading) {
    return <div className={cn('animate-pulse rounded-lg bg-slate-50 h-48', className)} />
  }

  // Get unique cycles (sorted by cycle_id ascending)
  const cycleIds = [...new Set(trends.map((t) => t.cycle_id))].sort((a, b) => a - b)
  const cycleLabels = Object.fromEntries(trends.map((t) => [t.cycle_id, t.cycle_label]))

  if (cycleIds.length < 2) {
    return (
      <div className={cn('flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400', className)}>
        Need at least 2 cycles to show trends.
      </div>
    )
  }

  // Build data per box
  const boxData: Record<number, number[]> = {}
  for (let b = 1; b <= 9; b++) {
    boxData[b] = cycleIds.map((cid) => {
      const row = trends.find((t) => t.cycle_id === cid && t.box === b)
      return row?.count ?? 0
    })
  }

  // If percent mode, normalize each cycle
  const totalsPerCycle = cycleIds.map((_, ci) =>
    Array.from({ length: 9 }, (_, b) => boxData[b + 1][ci]).reduce((s, v) => s + v, 0),
  )

  function getValue(box: number, cycleIndex: number): number {
    const abs = boxData[box][cycleIndex]
    if (mode === 'percent') {
      const total = totalsPerCycle[cycleIndex]
      return total > 0 ? Math.round((abs / total) * 100) : 0
    }
    return abs
  }

  const maxVal = Math.max(
    ...Array.from({ length: 9 }, (_, b) =>
      cycleIds.map((_, ci) => getValue(b + 1, ci)).reduce((a, v) => Math.max(a, v), 0),
    ),
    1,
  )

  const width = 500
  const height = 200
  const margin = { top: 10, right: 20, bottom: 30, left: 30 }
  const innerW = width - margin.left - margin.right
  const innerH = height - margin.top - margin.bottom

  const xScale = scaleBand({
    range: [0, innerW],
    domain: cycleIds.map((id) => cycleLabels[id] ?? String(id)),
    padding: 0.2,
  })

  const yScale = scaleLinear({
    range: [innerH, 0],
    domain: [0, maxVal],
    nice: true,
  })

  return (
    <div className={cn('space-y-2', className)}>
      {/* Toggle */}
      <div className="flex gap-2">
        {(['absolute', 'percent'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium',
              mode === m
                ? 'bg-slate-800 text-white'
                : 'border border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            {m === 'absolute' ? 'Counts' : 'Percent'}
          </button>
        ))}
      </div>

      <svg width={width} height={height}>
        <Group left={margin.left} top={margin.top}>
          {/* Lines per box */}
          {Array.from({ length: 9 }, (_, b) => b + 1).map((box) => {
            const pts = cycleIds.map((id, ci) => ({
              x: (xScale(cycleLabels[id] ?? String(id)) ?? 0) + xScale.bandwidth() / 2,
              y: yScale(getValue(box, ci)) ?? 0,
            }))
            return (
              <LinePath
                key={box}
                data={pts}
                x={(d) => d.x}
                y={(d) => d.y}
                stroke={BOX_COLORS[box]}
                strokeWidth={1.5}
                strokeOpacity={0.7}
              />
            )
          })}

          <AxisBottom
            scale={xScale}
            top={innerH}
            stroke="transparent"
            tickStroke="transparent"
            tickLabelProps={{ fontSize: 9, fill: '#94a3b8', textAnchor: 'middle' }}
          />
          <AxisLeft
            scale={yScale}
            numTicks={4}
            stroke="transparent"
            tickStroke="transparent"
            tickLabelProps={{ fontSize: 9, fill: '#94a3b8', textAnchor: 'end' }}
          />
        </Group>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 9 }, (_, b) => b + 1).map((box) => (
          <span key={box} className="inline-flex items-center gap-1 text-xs text-slate-500">
            <span
              className="inline-block h-2 w-4 rounded-sm"
              style={{ backgroundColor: BOX_COLORS[box] }}
            />
            Box {box}
          </span>
        ))}
      </div>
    </div>
  )
}
