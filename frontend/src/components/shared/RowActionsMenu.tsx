import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'

interface RowActionsMenuProps {
  onEdit: () => void
  onDelete: () => void
}

export default function RowActionsMenu({ onEdit, onDelete }: RowActionsMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[8rem] overflow-hidden rounded-md border border-slate-200 bg-white p-1 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Item
            onSelect={onEdit}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onDelete}
            className="flex cursor-pointer items-center gap-2 rounded-sm px-3 py-1.5 text-sm text-red-600 outline-none hover:bg-red-50 focus:bg-red-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
