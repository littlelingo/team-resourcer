import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Avatar from '@radix-ui/react-avatar'
import { MoreVertical, MapPin, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getImageUrl } from '@/lib/api-client'
import { getInitials } from '@/lib/member-utils'
import type { TeamMemberList } from '@/types'

interface MemberCardProps {
  member: TeamMemberList
  onEdit: (member: TeamMemberList) => void
  onDelete: (member: TeamMemberList) => void
  onClick: (member: TeamMemberList) => void
}

export default function MemberCard({ member, onEdit, onDelete, onClick }: MemberCardProps) {
  const imageUrl = getImageUrl(member.image_path)
  const initials = getInitials(member.first_name, member.last_name)

  return (
    <div
      className={cn(
        'relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm',
        'cursor-pointer transition-shadow hover:shadow-md',
      )}
      onClick={() => onClick(member)}
    >
      {/* Kebab menu — stop propagation so card click doesn't fire */}
      <div
        className="absolute right-3 top-3"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              aria-label="Member actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className={cn(
                'z-50 min-w-[120px] rounded-md border border-slate-200 bg-white p-1 shadow-md',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
              )}
            >
              <DropdownMenu.Item
                onSelect={() => onEdit(member)}
                className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-slate-700 outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100"
              >
                Edit
              </DropdownMenu.Item>
              <DropdownMenu.Item
                onSelect={() => onDelete(member)}
                className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-red-600 outline-none transition-colors hover:bg-red-50 focus:bg-red-50"
              >
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Avatar + name + title */}
      <div className="flex flex-col items-center text-center">
        <Avatar.Root className="mb-3 h-16 w-16 overflow-hidden rounded-full bg-slate-200 flex-shrink-0">
          <Avatar.Image
            src={imageUrl}
            alt={`${member.first_name} ${member.last_name}`}
            className="h-full w-full object-cover"
          />
          <Avatar.Fallback className="flex h-full w-full items-center justify-center text-base font-semibold text-slate-600">
            {initials}
          </Avatar.Fallback>
        </Avatar.Root>

        <h3 className="pr-6 text-sm font-semibold text-slate-900 leading-tight line-clamp-1">
          {`${member.first_name} ${member.last_name}`}
        </h3>
        {member.title && (
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{member.title}</p>
        )}
      </div>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap justify-center gap-1">
        {member.functional_area && (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
            {member.functional_area.name}
          </span>
        )}
        {member.team && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
            {member.team.name}
          </span>
        )}
        {member.program_assignments?.slice(0, 2).map((pa, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
          >
            {pa.program?.name ?? `Program ${i + 1}`}
            {pa.program_team && (
              <span className="ml-1 text-slate-400">· {pa.program_team.name}</span>
            )}
          </span>
        ))}
        {(member.program_assignments?.length ?? 0) > 2 && (
          <span
            className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500 cursor-default"
            title={member.program_assignments!.slice(2).map((pa) => pa.program?.name ?? '').join(', ')}
          >
            +{member.program_assignments!.length - 2} more
          </span>
        )}
      </div>

      {/* Location */}
      {(member.city || member.state) && (
        <div className="mt-3 flex items-center justify-center gap-1 text-xs text-slate-400">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">
            {[member.city, member.state].filter(Boolean).join(', ')}
          </span>
        </div>
      )}

      {/* Employee ID */}
      {member.employee_id && (
        <div className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400">
          <Hash className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">{member.employee_id}</span>
        </div>
      )}

      {/* Functional Manager */}
      {member.functional_manager_name && (
        <div className="mt-2 flex items-center justify-center gap-1 text-xs text-slate-400">
          <span className="text-slate-500">FM:</span>
          <span className="truncate">{member.functional_manager_name}</span>
        </div>
      )}

      {/* Calibration indicator */}
      {member.latest_calibration && (
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded text-xs font-bold',
              member.latest_calibration.box === 0
                ? 'bg-slate-300 text-slate-600'
                : member.latest_calibration.box <= 3
                  ? 'bg-emerald-500 text-white'
                  : member.latest_calibration.box <= 6
                    ? 'bg-blue-500 text-white'
                    : 'bg-slate-400 text-white',
            )}
          >
            {member.latest_calibration.box}
          </span>
          <span className="text-xs text-slate-500 truncate">
            {member.latest_calibration.label}
          </span>
        </div>
      )}
    </div>
  )
}
