import * as Popover from '@radix-ui/react-popover'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WidgetId, WidgetCategory } from './widgets/types'
import { WIDGET_REGISTRY, WIDGET_IDS } from './widgets/registry'

interface WidgetToggleMenuProps {
  visible: Set<WidgetId>
  onToggle: (id: WidgetId) => void
}

const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  overview: 'Overview',
  distribution: 'Distribution',
  movement: 'Movement',
  comparison: 'Comparison',
  trends: 'Trends',
}

const CATEGORIES: WidgetCategory[] = ['overview', 'distribution', 'movement', 'comparison', 'trends']

export default function WidgetToggleMenu({ visible, onToggle }: WidgetToggleMenuProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
          aria-label="Toggle widgets"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Widgets
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
          sideOffset={8}
          align="end"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Visible Widgets
          </p>
          {CATEGORIES.map((cat) => {
            const widgets = WIDGET_IDS.filter((id) => WIDGET_REGISTRY[id].category === cat)
            if (widgets.length === 0) return null
            return (
              <div key={cat} className="mb-3">
                <p className="mb-1 text-xs font-medium text-slate-400">
                  {CATEGORY_LABELS[cat]}
                </p>
                {widgets.map((id) => {
                  const def = WIDGET_REGISTRY[id]
                  const isOn = visible.has(id)
                  return (
                    <label
                      key={id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => onToggle(id)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
                      />
                      <span className={cn('text-sm', isOn ? 'text-slate-800' : 'text-slate-400')}>
                        {def.label}
                      </span>
                    </label>
                  )
                })}
              </div>
            )
          })}
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
