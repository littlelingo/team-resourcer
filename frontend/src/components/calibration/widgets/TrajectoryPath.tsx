/**
 * TrajectoryPath — Phase 5 widget stub.
 * Full implementation with SVG path + marker-end arrives in Phase 5.
 */
interface TrajectoryPathProps {
  memberUuid?: string
  mode?: 'detail-sheet' | 'page'
  className?: string
}

export default function TrajectoryPath({ mode = 'page' }: TrajectoryPathProps) {
  if (mode === 'detail-sheet') {
    return (
      <div className="flex h-16 items-center justify-center rounded border border-dashed border-slate-200 text-xs text-slate-400">
        Trajectory — Phase 5
      </div>
    )
  }
  return (
    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
      Trajectory Path — coming in Phase 5
    </div>
  )
}
