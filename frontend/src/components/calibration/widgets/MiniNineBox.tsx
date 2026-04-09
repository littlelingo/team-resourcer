/**
 * MiniNineBox — shared compact 9-box for cohort comparison.
 * Used by CohortSmallMultiples and (optionally) other widgets.
 */
import { cn } from '@/lib/utils'
import type { CalibrationLatestRow } from '@/api/calibrationApi'

const BOX_BG: Record<number, string> = {
  1: 'bg-emerald-500/20', 2: 'bg-emerald-400/15', 3: 'bg-yellow-400/15',
  4: 'bg-emerald-300/15', 5: 'bg-blue-400/15',   6: 'bg-yellow-300/15',
  7: 'bg-blue-300/15',   8: 'bg-slate-200/20',   9: 'bg-red-200/15',
}

interface MiniNineBoxProps {
  calibrations: CalibrationLatestRow[]
  title?: string
  className?: string
}

export default function MiniNineBox({ calibrations, title, className }: MiniNineBoxProps) {
  const byBox: Record<number, number> = {}
  for (let b = 1; b <= 9; b++) byBox[b] = 0
  for (const cal of calibrations) byBox[cal.box] = (byBox[cal.box] ?? 0) + 1

  const maxCount = Math.max(...Object.values(byBox), 1)

  // Layout: row-major, box 3 at top-left
  const gridOrder = [[3, 2, 1], [6, 5, 4], [9, 8, 7]]

  return (
    <div className={cn('space-y-1', className)}>
      {title && (
        <p className="text-xs font-medium text-slate-700 truncate">{title}</p>
      )}
      <div className="grid grid-rows-3 gap-0.5">
        {gridOrder.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-0.5">
            {row.map((box) => {
              const count = byBox[box] ?? 0
              const intensity = count / maxCount
              return (
                <div
                  key={box}
                  className={cn(
                    'h-8 w-8 flex items-center justify-center rounded-sm text-xs font-semibold transition-opacity',
                    BOX_BG[box],
                  )}
                  style={{ opacity: count === 0 ? 0.2 : 0.3 + intensity * 0.7 }}
                  title={`Box ${box}: ${count}`}
                >
                  {count > 0 ? count : ''}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">{calibrations.length} members</p>
    </div>
  )
}
