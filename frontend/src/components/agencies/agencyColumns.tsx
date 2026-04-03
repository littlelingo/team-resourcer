import type { ColumnDef } from '@tanstack/react-table'
import RowActionsMenu from '@/components/shared/RowActionsMenu'
import type { Agency } from '@/types'

interface AgencyColumnsOptions {
  onEdit: (agency: Agency) => void
  onDelete: (agency: Agency) => void
}

export function getAgencyColumns({
  onEdit,
  onDelete,
}: AgencyColumnsOptions): ColumnDef<Agency>[] {
  return [
    {
      accessorKey: 'name',
      header: 'Name',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="font-medium text-slate-900">{row.original.name}</span>
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
      accessorKey: 'member_count',
      header: 'Members',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-slate-700">{row.original.member_count ?? 0}</span>
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
