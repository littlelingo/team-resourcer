import * as SelectPrimitive from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SelectFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: { value: string; label: string }[]
  disabled?: boolean
}

const NONE_VALUE = '__none__'

export default function SelectField({ value, onChange, placeholder, options, disabled }: SelectFieldProps) {
  return (
    <SelectPrimitive.Root value={value || NONE_VALUE} onValueChange={(v) => onChange(v === NONE_VALUE ? '' : v)} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm',
          'placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !value && 'text-slate-400',
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className={cn(
            'z-[100] min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="p-1 max-h-60 overflow-y-auto">
            {/* "None" option to clear the selection */}
            <SelectPrimitive.Item
              value={NONE_VALUE}
              className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-slate-500 outline-none hover:bg-slate-100 focus:bg-slate-100"
            >
              <SelectPrimitive.ItemIndicator className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                <Check className="h-3.5 w-3.5" />
              </SelectPrimitive.ItemIndicator>
              <SelectPrimitive.ItemText>None</SelectPrimitive.ItemText>
            </SelectPrimitive.Item>
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <Check className="h-3.5 w-3.5" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
