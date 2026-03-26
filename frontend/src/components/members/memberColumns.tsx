import type { ColumnDef } from '@tanstack/react-table'
import * as Avatar from '@radix-ui/react-avatar'
import { getImageUrl } from '@/lib/api-client'
import { getInitials } from '@/lib/member-utils'
import RowActionsMenu from '@/components/shared/RowActionsMenu'
import type { TeamMemberList } from '@/types'

// Extended type for the columns — members list items may have embedded relations
// when fetched with full detail, but TeamMemberList is the base shape.
type MemberRow = TeamMemberList & {
  functional_area?: { id: number; name: string; description: string | null }
  team?: { id: number; name: string; functional_area_id: number }
  program_assignments?: {
    program_id: number
    role: string | null
    program?: { id: number; name: string }
  }[]
}

interface ColumnMeta {
  onEdit: (member: MemberRow) => void
  onDelete: (member: MemberRow) => void
}

export function buildMemberColumns(meta: ColumnMeta): ColumnDef<MemberRow>[] {
  return [
    {
      id: 'member',
      accessorFn: (row) => `${row.last_name}, ${row.first_name}`,
      header: 'Member',
      enableSorting: true,
      cell: ({ row }) => {
        const member = row.original
        const imageUrl = getImageUrl(member.image_path)
        const initials = getInitials(member.first_name, member.last_name)
        return (
          <div className="flex items-center gap-3 min-w-0">
            <Avatar.Root className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-slate-200">
              <Avatar.Image
                src={imageUrl}
                alt={`${member.first_name} ${member.last_name}`}
                className="h-full w-full object-cover"
              />
              <Avatar.Fallback className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                {initials}
              </Avatar.Fallback>
            </Avatar.Root>
            <div className="min-w-0">
              <p className="font-medium text-slate-900 truncate">{`${member.first_name} ${member.last_name}`}</p>
              {member.title && (
                <p className="text-xs text-slate-500 truncate">{member.title}</p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      id: 'employee_id',
      accessorKey: 'employee_id',
      header: 'Employee ID',
      enableSorting: true,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-slate-600">{getValue() as string}</span>
      ),
    },
    {
      id: 'functional_area',
      accessorFn: (row) => row.functional_area?.name ?? '',
      header: 'Functional Area',
      enableSorting: true,
      cell: ({ row }) => {
        const name = row.original.functional_area?.name
        if (!name) return <span className="text-slate-400">—</span>
        return (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {name}
          </span>
        )
      },
    },
    {
      id: 'team',
      accessorFn: (row) => row.team?.name ?? '',
      header: 'Team',
      enableSorting: true,
      cell: ({ row }) => {
        const name = row.original.team?.name
        return name ? (
          <span className="text-sm text-slate-700">{name}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )
      },
    },
    {
      id: 'location',
      accessorKey: 'location',
      header: 'Location',
      enableSorting: true,
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        return val ? (
          <span className="text-sm text-slate-700">{val}</span>
        ) : (
          <span className="text-slate-400">—</span>
        )
      },
    },
    {
      id: 'programs',
      accessorFn: (row) =>
        row.program_assignments?.map((pa) => pa.program?.name ?? '').join(', ') ?? '',
      header: 'Programs',
      enableSorting: false,
      cell: ({ row }) => {
        const assignments = row.original.program_assignments
        if (!assignments || assignments.length === 0) {
          return <span className="text-slate-400">—</span>
        }
        return (
          <span className="text-sm text-slate-600">
            {assignments.map((pa) => pa.program?.name ?? `#${pa.program_id}`).join(', ')}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActionsMenu
          onEdit={() => meta.onEdit(row.original)}
          onDelete={() => meta.onDelete(row.original)}
        />
      ),
    },
  ]
}
