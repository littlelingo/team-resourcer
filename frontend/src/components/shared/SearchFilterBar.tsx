import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FilterOption {
  key: string
  label: string
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
}

interface SearchFilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  filters: FilterOption[]
  className?: string
}

export default function SearchFilterBar({
  search,
  onSearchChange,
  filters,
  className,
}: SearchFilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {/* Search input */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search..."
          className={cn(
            'h-9 w-64 rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm',
            'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400',
            'transition-colors hover:border-slate-300',
          )}
        />
      </div>

      {/* Filter selects */}
      {filters.map((filter) => (
        <div key={filter.key} className="flex-shrink-0">
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            aria-label={filter.label}
            className={cn(
              'h-9 rounded-md border border-slate-200 bg-white px-3 pr-8 text-sm',
              'focus:outline-none focus:ring-2 focus:ring-slate-400',
              'transition-colors hover:border-slate-300 cursor-pointer',
              'appearance-none bg-no-repeat bg-[right_0.5rem_center]',
              // Inline chevron-down SVG as background
              "[background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
            )}
          >
            <option value="">All {filter.label}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}
