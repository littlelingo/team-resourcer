import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MultiSelectFieldProps {
  value: string[]
  onChange: (value: string[]) => void
  placeholder: string
  options: { value: string; label: string }[]
  disabled?: boolean
}

export default function MultiSelectField({
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: MultiSelectFieldProps) {
  const selectedLabels = options
    .filter((opt) => value.includes(opt.value))
    .map((opt) => opt.label)

  const displayText =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels.length} selected`

  function toggle(optValue: string) {
    if (value.includes(optValue)) {
      onChange(value.filter((v) => v !== optValue))
    } else {
      onChange([...value, optValue])
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-slate-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          selectedLabels.length === 0 && 'text-slate-400',
        )}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={cn(
            'z-[100] min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
          sideOffset={4}
          align="start"
        >
          <div className="max-h-60 overflow-y-auto p-1">
            {options.length === 0 && (
              <div className="py-2 px-3 text-sm text-slate-400">No options</div>
            )}
            {options.map((opt) => {
              const checked = value.includes(opt.value)
              return (
                <DropdownMenu.CheckboxItem
                  key={opt.value}
                  checked={checked}
                  onCheckedChange={() => toggle(opt.value)}
                  onSelect={(e) => e.preventDefault()}
                  className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100"
                >
                  <DropdownMenu.ItemIndicator className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                    <Check className="h-3.5 w-3.5" />
                  </DropdownMenu.ItemIndicator>
                  {opt.label}
                </DropdownMenu.CheckboxItem>
              )
            })}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
