import { Suspense, useState } from 'react'
import { Users } from 'lucide-react'
import { CalibrationFilterProvider, useCalibrationFilters } from '@/components/calibration/CalibrationFilterContext'
import { useWidgetVisibility } from '@/components/calibration/useWidgetVisibility'
import WidgetToggleMenu from '@/components/calibration/WidgetToggleMenu'
import WidgetSkeleton from '@/components/calibration/WidgetSkeleton'
import { WIDGET_REGISTRY } from '@/components/calibration/widgets/registry'
import { useCalibrationCycles } from '@/hooks/useCalibrationCycles'
import CompareDrawer from '@/components/calibration/CompareDrawer'

// ─── Filter bar ───────────────────────────────────────────────────────────────

function CyclePicker() {
  const { data: cycles = [] } = useCalibrationCycles()
  const { cycleId, setFilter } = useCalibrationFilters()

  return (
    <select
      value={cycleId ?? ''}
      onChange={(e) => setFilter('cycleId', e.target.value ? Number(e.target.value) : undefined)}
      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm"
    >
      <option value="">All cycles</option>
      {cycles.map((c) => (
        <option key={c.id} value={c.id}>
          {c.label}
        </option>
      ))}
    </select>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function CalibrationPageInner() {
  const { visible, toggle } = useWidgetVisibility()
  const [compareOpen, setCompareOpen] = useState(false)

  const KpiStrip = WIDGET_REGISTRY['kpi-strip'].component
  const NineBoxGrid = WIDGET_REGISTRY['nine-box-grid'].component
  const MarginalBars = WIDGET_REGISTRY['marginal-bars'].component
  const MovementSankey = WIDGET_REGISTRY['movement-sankey'].component
  const CohortSmallMultiples = WIDGET_REGISTRY['cohort-small-multiples'].component
  const CycleTrendLines = WIDGET_REGISTRY['cycle-trend-lines'].component

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Calibration</h1>
          <p className="mt-0.5 text-sm text-slate-500">9-Box Matrix visualization</p>
        </div>
        <div className="flex items-center gap-2">
          <CyclePicker />
          <WidgetToggleMenu visible={visible} onToggle={toggle} />
          <button
            onClick={() => setCompareOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Users className="h-3.5 w-3.5" />
            Compare
          </button>
        </div>
      </div>

      <CompareDrawer open={compareOpen} onOpenChange={setCompareOpen} />

      {/* KPI Strip — full width */}
      {visible.has('kpi-strip') && (
        <Suspense fallback={<WidgetSkeleton height="h-16" />}>
          <KpiStrip />
        </Suspense>
      )}

      {/* Main layout: 9-box + marginal bars */}
      {(visible.has('nine-box-grid') || visible.has('marginal-bars')) && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8 rounded-lg border border-slate-200 bg-white p-4">
            {visible.has('nine-box-grid') && (
              <Suspense fallback={<WidgetSkeleton height="h-64" />}>
                <NineBoxGrid />
              </Suspense>
            )}
          </div>
          <div className="col-span-4 rounded-lg border border-slate-200 bg-white p-4">
            {visible.has('marginal-bars') && (
              <Suspense fallback={<WidgetSkeleton height="h-48" />}>
                <MarginalBars />
              </Suspense>
            )}
          </div>
        </div>
      )}

      {/* Phase 5 widgets */}
      {visible.has('movement-sankey') && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-700">Movement Between Cycles</h2>
          <Suspense fallback={<WidgetSkeleton height="h-64" />}>
            <MovementSankey />
          </Suspense>
        </div>
      )}

      {visible.has('cohort-small-multiples') && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-700">Cohort Comparison</h2>
          <Suspense fallback={<WidgetSkeleton height="h-64" />}>
            <CohortSmallMultiples />
          </Suspense>
        </div>
      )}

      {visible.has('cycle-trend-lines') && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-medium text-slate-700">Cycle Trends</h2>
          <Suspense fallback={<WidgetSkeleton height="h-48" />}>
            <CycleTrendLines />
          </Suspense>
        </div>
      )}
    </div>
  )
}

export default function CalibrationPage() {
  return (
    <CalibrationFilterProvider>
      <CalibrationPageInner />
    </CalibrationFilterProvider>
  )
}
