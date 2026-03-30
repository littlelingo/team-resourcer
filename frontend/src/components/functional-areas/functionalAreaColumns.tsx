import type { ColumnDef } from '@tanstack/react-table'
import RowActionsMenu from '@/components/shared/RowActionsMenu'
import type { FunctionalArea } from '@/types'

interface FunctionalAreaColumnsOptions {
  onEdit: (area: FunctionalArea) => void
  onDelete: (area: FunctionalArea) => void
  onSelect: (area: FunctionalArea) => void
}

export function getFunctionalAreaColumns({
  onEdit,
  onDelete,
  onSelect,
}: FunctionalAreaColumnsOptions): ColumnDef<FunctionalArea>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      enableSorting: true,
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => onSelect(row.original)}
          className="font-medium text-slate-900 hover:text-blue-600 hover:underline text-left"
        >
          {row.original.name}
        </button>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      enableSorting: false,
      cell: ({ row }) => (
        <span className="text-slate-500 line-clamp-2">
          {row.original.description ?? '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActionsMenu
          onEdit={() => onEdit(row.original)}
          onDelete={() => onDelete(row.original)}
        />
      ),
    },
  ]
}
