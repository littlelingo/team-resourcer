import { Search } from 'lucide-react'

interface TreeSearchBarProps {
  value: string
  onChange: (value: string) => void
}

export default function TreeSearchBar({ value, onChange }: TreeSearchBarProps) {
  return (
    <div className="absolute top-4 right-4 z-10">
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
        <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search members..."
          className="w-48 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
    </div>
  )
}
