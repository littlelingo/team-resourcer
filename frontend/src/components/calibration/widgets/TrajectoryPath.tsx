/**
 * TrajectoryPath — member's movement through the 9-box over time.
 * Two render modes:
 *   'detail-sheet' — compact (no labels)
 *   'page'         — full size in growth timeline
 */
import { cn } from '@/lib/utils'
import { useCalibrationHistory } from '@/hooks/useCalibrationHistory'
import type { Calibration } from '@/api/calibrationApi'

// Map box number to (col, row) in the grid (0-indexed, top-left = 0,0)
// Grid layout: col=performance-1 (0-2), row=3-potential (0=high pot, 2=low pot)
function boxToGridPos(box: number): [number, number] {
  const mapping: Record<number, [number, number]> = {
    1: [2, 0], 2: [1, 0], 3: [0, 0],
    4: [2, 1], 5: [1, 1], 6: [0, 1],
    7: [2, 2], 8: [1, 2], 9: [0, 2],
  }
  return mapping[box] ?? [1, 1]
}

const CELL = 30
const PAD = 8
const SVG_SIZE = 3 * CELL + 2 * PAD

const BOX_COLORS: Record<number, string> = {
  1: '#059669', 2: '#10b981', 3: '#d97706',
  4: '#34d399', 5: '#3b82f6', 6: '#fbbf24',
  7: '#60a5fa', 8: '#94a3b8', 9: '#f87171',
}

interface TrajectoryPathProps {
  memberUuid?: string
  mode?: 'detail-sheet' | 'page'
  history?: Calibration[]
  className?: string
}

function TrajectoryViz({
  history,
  size = SVG_SIZE,
  showLabels = false,
}: {
  history: Calibration[]
  size?: number
  showLabels?: boolean
}) {
  const cell = size / 3
  const pts = history.map((cal) => {
    const [c, r] = boxToGridPos(cal.box)
    return {
      x: c * cell + cell / 2,
      y: r * cell + cell / 2,
      box: cal.box,
      label: cal.cycle.label,
    }
  })

  return (
    <svg width={size} height={size} className="overflow-visible">
      {/* Grid cells */}
      {Array.from({ length: 9 }, (_, i) => {
        const col = i % 3
        const row = Math.floor(i / 3)
        return (
          <rect
            key={i}
            x={col * cell}
            y={row * cell}
            width={cell - 1}
            height={cell - 1}
            rx={2}
            fill="#f8fafc"
            stroke="#e2e8f0"
            strokeWidth={0.5}
          />
        )
      })}

      {/* Path line */}
      {pts.length > 1 && (
        <polyline
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="#6366f1"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          markerEnd="url(#arrow)"
        />
      )}

      {/* Arrow marker */}
      <defs>
        <marker
          id="arrow"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#6366f1" />
        </marker>
      </defs>

      {/* Dots */}
      {pts.map((pt, i) => (
        <g key={i}>
          <circle
            cx={pt.x}
            cy={pt.y}
            r={cell / 5}
            fill={BOX_COLORS[pt.box]}
            stroke="white"
            strokeWidth={1.5}
          />
          {showLabels && (
            <text
              x={pt.x}
              y={pt.y + cell / 4 + 8}
              textAnchor="middle"
              fontSize={7}
              fill="#64748b"
            >
              {pt.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  )
}

export default function TrajectoryPath({
  memberUuid,
  mode = 'page',
  history: propHistory,
  className,
}: TrajectoryPathProps) {
  const { data: fetchedHistory = [] } = useCalibrationHistory(
    memberUuid && !propHistory ? memberUuid : '',
  )
  const history = propHistory ?? fetchedHistory

  if (history.length === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400',
          mode === 'detail-sheet' ? 'h-16' : 'h-32',
          className,
        )}
      >
        First calibration coming soon.
      </div>
    )
  }

  if (mode === 'detail-sheet') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <TrajectoryViz history={history} size={72} />
        <div className="text-xs text-slate-500">
          {history.length} cycle{history.length !== 1 ? 's' : ''}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <TrajectoryViz history={history} size={SVG_SIZE * 2} showLabels />
    </div>
  )
}
