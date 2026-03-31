import { useState, useRef, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComboboxFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: { value: string; label: string }[]
  disabled?: boolean
}

export default function ComboboxField({
  value,
  onChange,
  placeholder,
  options,
  disabled,
}: ComboboxFieldProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedLabel = options.find((opt) => opt.value === value)?.label

  // Focus the search input when popover opens
  useEffect(() => {
    if (open) {
      // Small delay to let popover render before focusing
      const timer = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(timer)
    }
  }, [open])

  function handleSelect(optValue: string) {
    onChange(optValue)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        disabled={disabled}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-slate-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-slate-400',
        )}
      >
        <span className="truncate">{selectedLabel || placeholder}</span>
        <ChevronDown className="ml-2 h-4 w-4 flex-shrink-0 opacity-50" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={cn(
            'z-[100] w-[--radix-popover-trigger-width] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
          sideOffset={4}
          align="start"
        >
          <Command shouldFilter>
            <Command.Input
              ref={inputRef}
              value={search}
              onValueChange={setSearch}
              placeholder="Search..."
              className="flex h-9 w-full border-b border-slate-200 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-slate-400"
            />
            <Command.List className="max-h-60 overflow-y-auto p-1">
              <Command.Empty className="py-4 text-center text-sm text-slate-400">
                No results found.
              </Command.Empty>
              {/* None option to clear selection */}
              <Command.Item
                value="__none__"
                onSelect={() => handleSelect('')}
                className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-slate-500 outline-none data-[selected=true]:bg-slate-100"
              >
                <span className={cn('absolute left-2 flex h-3.5 w-3.5 items-center justify-center', value === '' ? 'opacity-100' : 'opacity-0')}>
                  <Check className="h-3.5 w-3.5" />
                </span>
                None
              </Command.Item>
              {options.map((opt) => (
                <Command.Item
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => handleSelect(opt.value)}
                  className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-slate-700 outline-none data-[selected=true]:bg-slate-100"
                >
                  <span className={cn('absolute left-2 flex h-3.5 w-3.5 items-center justify-center', value === opt.value ? 'opacity-100' : 'opacity-0')}>
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {opt.label}
                </Command.Item>
              ))}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
