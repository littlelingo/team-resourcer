import type { ComponentType, LazyExoticComponent } from 'react'

export type WidgetId =
  | 'nine-box-grid'
  | 'marginal-bars'
  | 'movement-sankey'
  | 'cohort-small-multiples'
  | 'filter-transitions'
  | 'trajectory-path'
  | 'kpi-strip'
  | 'cycle-trend-lines'

export type WidgetCategory = 'overview' | 'distribution' | 'movement' | 'comparison' | 'trends'

export type DataSource = 'latest' | 'movement' | 'trends' | 'member-history' | 'none'

export interface WidgetDef {
  id: WidgetId
  label: string
  description: string
  category: WidgetCategory
  dataSource: DataSource
  defaultVisible: boolean
  component: LazyExoticComponent<ComponentType<WidgetProps>>
}

export interface WidgetProps {
  /** Optional className for outer container */
  className?: string
}
