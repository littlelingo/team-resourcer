import { useState, useMemo } from 'react'
import { Group } from '@visx/group'
import { useCalibrationCycles } from '@/hooks/useCalibrationCycles'
import { useCalibrationMovement } from '@/hooks/useCalibrationMovement'
import { cn } from '@/lib/utils'

// Box labels for display
const BOX_LABELS: Record<number, string> = {
  1: 'Star (1)', 2: 'Hi Pot (2)', 3: 'Enigma (3)',
  4: 'Hi Prof+ (4)', 5: 'Key Perf (5)', 6: 'Dev Prof (6)',
  7: 'Const Star (7)', 8: 'Reliable (8)', 9: 'Underperf (9)',
}

const BOX_COLORS: Record<number, string> = {
  1: '#059669', 2: '#10b981', 3: '#d97706',
  4: '#34d399', 5: '#3b82f6', 6: '#fbbf24',
  7: '#60a5fa', 8: '#94a3b8', 9: '#f87171',
}

interface FlowDatum {
  from_box: number
  to_box: number
  count: number
}

const NODE_HEIGHT = 30
const NODE_GAP = 8
const TOTAL_HEIGHT = 9 * (NODE_HEIGHT + NODE_GAP) - NODE_GAP
const SVG_WIDTH = 600
const NODE_WIDTH = 120
const COL_GAP = SVG_WIDTH - 2 * NODE_WIDTH

function getNodeY(box: number): number {
  // Boxes 1-9: box 1 at top, 9 at bottom
  return (box - 1) * (NODE_HEIGHT + NODE_GAP)
}

interface MovementSankeyProps {
  className?: string
}

export default function MovementSankey({ className }: MovementSankeyProps) {
  const { data: cycles = [] } = useCalibrationCycles()
  const [fromId, setFromId] = useState<number | null>(null)
  const [toId, setToId] = useState<number | null>(null)
  const [minFlow, setMinFlow] = useState(1)
  const [hoveredFrom, setHoveredFrom] = useState<number | null>(null)

  const firstCycle = cycles[0]
  const secondCycle = cycles[1]

  const resolvedFrom = fromId ?? firstCycle?.id ?? 0
  const resolvedTo = toId ?? secondCycle?.id ?? 0

  const { data: movement = [], isLoading } = useCalibrationMovement(resolvedFrom, resolvedTo)

  // Aggregate flow counts
  const flows = useMemo<FlowDatum[]>(() => {
    const map: Record<string, number> = {}
    for (const row of movement) {
      const key = `${row.from_box}-${row.to_box}`
      map[key] = (map[key] ?? 0) + 1
    }
    return Object.entries(map)
      .map(([key, count]) => {
        const [from, to] = key.split('-').map(Number)
        return { from_box: from, to_box: to, count }
      })
      .filter((f) => f.count >= minFlow)
  }, [movement, minFlow])

  if (cycles.length < 2) {
    return (
      <div className={cn('flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400', className)}>
        Need at least 2 calibration cycles to show movement.
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">From</label>
          <select
            value={resolvedFrom}
            onChange={(e) => setFromId(Number(e.target.value))}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id} disabled={c.id === resolvedTo}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">To</label>
          <select
            value={resolvedTo}
            onChange={(e) => setToId(Number(e.target.value))}
            className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
          >
            {cycles.map((c) => (
              <option key={c.id} value={c.id} disabled={c.id === resolvedFrom}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-slate-500">Min moves</label>
          <input
            type="range"
            min={1}
            max={10}
            value={minFlow}
            onChange={(e) => setMinFlow(Number(e.target.value))}
            className="w-20"
          />
          <span className="text-xs text-slate-700">≥{minFlow}</span>
        </div>
      </div>

      {isLoading && (
        <div className="h-48 animate-pulse rounded-lg bg-slate-50" />
      )}

      {!isLoading && flows.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
          No moves matching the current filter.
        </div>
      )}

      {!isLoading && flows.length > 0 && (
        <svg
          width={SVG_WIDTH}
          height={TOTAL_HEIGHT + 20}
          className="overflow-visible"
        >
          <Group>
            {/* Left nodes (from) */}
            {Array.from({ length: 9 }, (_, i) => i + 1).map((box) => {
              const y = getNodeY(box)
              const hasFlow = flows.some((f) => f.from_box === box)
              return (
                <g key={`from-${box}`}>
                  <rect
                    x={0}
                    y={y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={4}
                    fill={BOX_COLORS[box]}
                    opacity={hasFlow ? 0.9 : 0.2}
                    onMouseEnter={() => setHoveredFrom(box)}
                    onMouseLeave={() => setHoveredFrom(null)}
                  />
                  <text
                    x={NODE_WIDTH / 2}
                    y={y + NODE_HEIGHT / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={9}
                    fill="white"
                  >
                    {BOX_LABELS[box]}
                  </text>
                </g>
              )
            })}

            {/* Right nodes (to) */}
            {Array.from({ length: 9 }, (_, i) => i + 1).map((box) => {
              const y = getNodeY(box)
              const hasFlow = flows.some((f) => f.to_box === box)
              return (
                <g key={`to-${box}`}>
                  <rect
                    x={NODE_WIDTH + COL_GAP}
                    y={y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    rx={4}
                    fill={BOX_COLORS[box]}
                    opacity={hasFlow ? 0.9 : 0.2}
                  />
                  <text
                    x={NODE_WIDTH + COL_GAP + NODE_WIDTH / 2}
                    y={y + NODE_HEIGHT / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={9}
                    fill="white"
                  >
                    {BOX_LABELS[box]}
                  </text>
                </g>
              )
            })}

            {/* Flow ribbons */}
            {flows.map((flow) => {
              const fromY = getNodeY(flow.from_box) + NODE_HEIGHT / 2
              const toY = getNodeY(flow.to_box) + NODE_HEIGHT / 2
              const strokeW = Math.max(2, Math.min(flow.count * 2, 20))
              const isHighlighted = hoveredFrom === null || hoveredFrom === flow.from_box

              const midX = NODE_WIDTH + COL_GAP / 2
              const d = `M ${NODE_WIDTH} ${fromY} C ${midX} ${fromY} ${midX} ${toY} ${NODE_WIDTH + COL_GAP} ${toY}`

              return (
                <path
                  key={`${flow.from_box}-${flow.to_box}`}
                  d={d}
                  stroke={BOX_COLORS[flow.from_box]}
                  strokeWidth={strokeW}
                  fill="none"
                  opacity={isHighlighted ? 0.6 : 0.08}
                />
              )
            })}
          </Group>
        </svg>
      )}
    </div>
  )
}
