import { useState } from 'react'
import * as Tooltip from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'
import { useLatestCalibrations } from '@/hooks/useCalibrations'
import { useCalibrationFilters } from '../CalibrationFilterContext'
import type { CalibrationLatestRow } from '@/api/calibrationApi'

// Box label lookup
const BOX_LABELS: Record<number, string> = {
  1: 'Star', 2: 'High Potential', 3: 'Enigma',
  4: 'High Prof+', 5: 'Key Performer', 6: 'Dev Professional',
  7: 'Consistent Star', 8: 'Reliable', 9: 'Underperformer',
}

// Color theme per box — intensity reflects "desirability"
const BOX_BG: Record<number, string> = {
  1: 'bg-emerald-500/15', 2: 'bg-emerald-400/10', 3: 'bg-yellow-400/10',
  4: 'bg-emerald-400/10', 5: 'bg-blue-400/10',   6: 'bg-yellow-300/10',
  7: 'bg-blue-300/10',   8: 'bg-slate-200/30',   9: 'bg-red-200/20',
}

const BOX_DOT: Record<number, string> = {
  1: 'bg-emerald-600 text-white', 2: 'bg-emerald-500 text-white', 3: 'bg-yellow-500 text-white',
  4: 'bg-emerald-400 text-white', 5: 'bg-blue-500 text-white',   6: 'bg-yellow-400 text-white',
  7: 'bg-blue-400 text-white',   8: 'bg-slate-400 text-white',   9: 'bg-red-400 text-white',
}

const CHIP_CAP = 12

function MemberChip({ cal, onOpen }: {
  cal: CalibrationLatestRow
  onOpen: (uuid: string) => void
}) {
  return (
    <Tooltip.Provider>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            onClick={() => onOpen(cal.member_uuid)}
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold shadow-sm transition-transform hover:scale-110',
              BOX_DOT[cal.box],
            )}
            aria-label={`Member in box ${cal.box}`}
          >
            {cal.box}
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
            sideOffset={4}
          >
            <p className="font-medium">{cal.label}</p>
            {cal.ready_for_promotion && (
              <p className="text-slate-500">Promo: {cal.ready_for_promotion}</p>
            )}
            {cal.can_mentor_juniors && (
              <p className="text-slate-500">Mentor: {cal.can_mentor_juniors}</p>
            )}
            <Tooltip.Arrow className="fill-white" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}

interface NineBoxGridProps {
  onMemberClick?: (uuid: string) => void
  className?: string
}

export default function NineBoxGrid({ onMemberClick, className }: NineBoxGridProps) {
  const { areaId, teamId, programId, cycleId } = useCalibrationFilters()
  const { data: calibrations = [], isLoading } = useLatestCalibrations({
    area_id: areaId,
    team_id: teamId,
    program_id: programId,
    cycle_id: cycleId,
  })

  const [expanded, setExpanded] = useState<number | null>(null)

  if (isLoading) {
    return (
      <div className={cn('animate-pulse rounded-lg bg-slate-50 h-64', className)} />
    )
  }

  if (calibrations.length === 0) {
    return (
      <div className={cn('rounded-lg border border-dashed border-slate-200 p-8 text-center', className)}>
        <p className="text-sm text-slate-500">Import calibration data to populate the matrix.</p>
      </div>
    )
  }

  // Group by box
  const byBox: Record<number, CalibrationLatestRow[]> = {}
  for (let b = 1; b <= 9; b++) byBox[b] = []
  for (const cal of calibrations) {
    if (byBox[cal.box]) byBox[cal.box].push(cal)
  }

  const maxCount = Math.max(...Object.values(byBox).map((a) => a.length), 1)

  // 9-box layout: performance increases left→right (cols), potential increases bottom→top (rows)
  // Grid display order (row-major, top-left = box 3, top-right = box 1):
  // row 0: boxes 3, 2, 1 (high potential)
  // row 1: boxes 6, 5, 4 (mid potential)
  // row 2: boxes 9, 8, 7 (low potential)
  const gridOrder = [[3, 2, 1], [6, 5, 4], [9, 8, 7]]

  return (
    <div className={cn('space-y-2', className)}>
      {/* Column headers */}
      <div className="grid grid-cols-3 gap-1 pl-8">
        {['Low Perf', 'Mid Perf', 'High Perf'].map((h) => (
          <div key={h} className="text-center text-xs font-medium text-slate-400">{h}</div>
        ))}
      </div>

      <div className="flex gap-1">
        {/* Row labels */}
        <div className="flex flex-col justify-around w-7 shrink-0">
          {['High', 'Mid', 'Low'].map((h) => (
            <div key={h} className="text-xs font-medium text-slate-400 text-right pr-1"
              style={{ writingMode: 'horizontal-tb' }}>
              {h}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 grid grid-rows-3 gap-1">
          {gridOrder.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-1">
              {row.map((boxNum) => {
                const members = byBox[boxNum] ?? []
                const intensity = members.length / maxCount
                const isExp = expanded === boxNum
                const displayCount = isExp ? members.length : CHIP_CAP

                return (
                  <div
                    key={boxNum}
                    className={cn(
                      'rounded-md border border-slate-200 p-2 min-h-[80px] transition-colors',
                      BOX_BG[boxNum],
                    )}
                    style={{ opacity: 0.4 + intensity * 0.6 }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn('flex h-5 w-5 items-center justify-center rounded text-xs font-bold', BOX_DOT[boxNum])}>
                        {boxNum}
                      </span>
                      <span className="text-xs text-slate-500">{members.length}</span>
                    </div>
                    <p className="text-xs text-slate-500 mb-1.5 truncate">{BOX_LABELS[boxNum]}</p>
                    <div className="flex flex-wrap gap-0.5">
                      {members.slice(0, displayCount).map((cal) => (
                        <MemberChip
                          key={cal.member_uuid}
                          cal={cal}
                          onOpen={onMemberClick ?? (() => {})}
                        />
                      ))}
                      {members.length > CHIP_CAP && !isExp && (
                        <button
                          onClick={() => setExpanded(boxNum)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          +{members.length - CHIP_CAP}
                        </button>
                      )}
                      {isExp && members.length > CHIP_CAP && (
                        <button
                          onClick={() => setExpanded(null)}
                          className="text-xs text-slate-400 hover:underline"
                        >
                          less
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
