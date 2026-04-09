/**
 * ComparisonRadar — hand-rolled radar chart with @visx/group + polar math.
 * Axes: box position, cycles tracked, net movement, ready-for-promo, mentor capacity.
 */
import { Group } from '@visx/group'
import type { Calibration } from '@/api/calibrationApi'

export interface RadarMember {
  uuid: string
  name: string
  calibrations: Calibration[]
  latestBox: number
}

interface ComparisonRadarProps {
  members: RadarMember[]
  className?: string
}

const AXES = [
  { label: 'Box', key: 'box', max: 9 },
  { label: 'Cycles', key: 'cycles', max: 8 },
  { label: 'Net Move', key: 'netMove', max: 9 },
  { label: 'Promo Ready', key: 'promo', max: 1 },
  { label: 'Mentors', key: 'mentor', max: 1 },
]

const YES_PATTERNS = /^(yes|ready|true|1)$/i

function memberToValues(m: RadarMember): number[] {
  const latest = m.calibrations[0]
  const oldest = m.calibrations[m.calibrations.length - 1]
  const box = latest?.box ?? 5
  const cycles = m.calibrations.length
  const netMove = oldest && latest ? Math.abs(oldest.box - latest.box) : 0
  const promo = latest?.ready_for_promotion && YES_PATTERNS.test(latest.ready_for_promotion) ? 1 : 0
  const mentor = latest?.can_mentor_juniors && YES_PATTERNS.test(latest.can_mentor_juniors) ? 1 : 0
  return [
    1 - (box - 1) / 8, // invert: box 1 = best
    Math.min(cycles / AXES[1].max, 1),
    Math.min(netMove / AXES[2].max, 1),
    promo,
    mentor,
  ]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']

const SIZE = 200
const CX = SIZE / 2
const CY = SIZE / 2
const R = 70

function polarToXY(angle: number, r: number): [number, number] {
  return [CX + r * Math.cos(angle - Math.PI / 2), CY + r * Math.sin(angle - Math.PI / 2)]
}

export default function ComparisonRadar({ members, className }: ComparisonRadarProps) {
  if (members.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
        Select 2–4 members to compare.
      </div>
    )
  }

  const n = AXES.length
  const axisAngles = AXES.map((_, i) => (i * 2 * Math.PI) / n)

  return (
    <svg width={SIZE} height={SIZE} className={className}>
      <Group>
        {/* Grid circles */}
        {[0.25, 0.5, 0.75, 1].map((scale) => {
          const pts = axisAngles.map((a) => polarToXY(a, R * scale))
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z'
          return (
            <path
              key={scale}
              d={d}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />
          )
        })}

        {/* Axis lines */}
        {axisAngles.map((angle, i) => {
          const [x, y] = polarToXY(angle, R)
          const [lx, ly] = polarToXY(angle, R + 20)
          return (
            <g key={i}>
              <line x1={CX} y1={CY} x2={x} y2={y} stroke="#e2e8f0" strokeWidth={0.5} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#94a3b8">
                {AXES[i].label}
              </text>
            </g>
          )
        })}

        {/* Member polygons */}
        {members.map((m, mi) => {
          const values = memberToValues(m)
          const pts = axisAngles.map((angle, i) => polarToXY(angle, R * values[i]))
          const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ') + ' Z'
          return (
            <path
              key={m.uuid}
              d={d}
              fill={COLORS[mi % COLORS.length]}
              fillOpacity={0.15}
              stroke={COLORS[mi % COLORS.length]}
              strokeWidth={1.5}
            />
          )
        })}
      </Group>
    </svg>
  )
}
