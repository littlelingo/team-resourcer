import type { ColumnDef } from '@tanstack/react-table'
import RowActionsMenu from '@/components/shared/RowActionsMenu'
import type { Team, FunctionalArea, TeamMemberList } from '@/types'

interface TeamColumnsOptions {
  areas: FunctionalArea[]
  members: TeamMemberList[]
  onEdit: (team: Team) => void
  onDelete: (team: Team) => void
  onSelect: (team: Team) => void
}

export function getTeamColumns({
  areas,
  members,
  onEdit,
  onDelete,
  onSelect,
}: TeamColumnsOptions): ColumnDef<Team>[] {
  const areaMap = new Map(areas.map((a) => [a.id, a.name]))
  const memberMap = new Map(members.map((m) => [m.uuid, `${m.first_name} ${m.last_name}`]))

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
      id: 'functional_area',
      header: 'Functional Area',
      enableSorting: true,
      accessorFn: (row) => areaMap.get(row.functional_area_id) ?? '',
      cell: ({ row }) => (
        <span className="text-slate-700">
          {areaMap.get(row.original.functional_area_id) ?? '—'}
        </span>
      ),
    },
    {
      id: 'lead',
      header: 'Lead',
      enableSorting: false,
      cell: ({ row }) => {
        const leadName = row.original.lead_id ? memberMap.get(row.original.lead_id) : null
        return <span className="text-slate-700">{leadName ?? '—'}</span>
      },
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
