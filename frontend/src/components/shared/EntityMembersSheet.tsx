import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import { X, UserPlus, Trash2 } from 'lucide-react'
import { getImageUrl } from '@/lib/api-client'
import { getInitials } from '@/lib/member-utils'
import ComboboxField from '@/components/shared/ComboboxField'
import type { TeamMemberList } from '@/types'

interface EntityMembersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  members: TeamMemberList[]
  isLoading: boolean
  allMembers: TeamMemberList[]
  onAdd: (memberUuid: string) => void
  onRemove: (memberUuid: string) => void
  leadId?: string | null
}

export default function EntityMembersSheet({
  open,
  onOpenChange,
  title,
  members,
  isLoading,
  allMembers,
  onAdd,
  onRemove,
  leadId,
}: EntityMembersSheetProps) {
  const [adding, setAdding] = useState(false)

  const assignedUuids = new Set(members.map((m) => m.uuid))
  const availableOptions = allMembers
    .filter((m) => !assignedUuids.has(m.uuid))
    .map((m) => ({ value: m.uuid, label: `${m.first_name} ${m.last_name}` }))

  function handleAdd(uuid: string) {
    if (!uuid) return
    onAdd(uuid)
    setAdding(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-80 bg-white shadow-xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-slate-900 truncate">
              {title}
            </Dialog.Title>
            <Dialog.Close className="rounded-md p-1 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Add member control */}
            <div className="mb-4">
              {adding ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ComboboxField
                      value=""
                      onChange={handleAdd}
                      placeholder="Select member..."
                      options={availableOptions}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setAdding(false)}
                    className="rounded-md p-1.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Member
                </button>
              )}
            </div>

            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Assigned Members ({members.length})
            </p>

            {isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />
                    <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {!isLoading && members.length === 0 && (
              <p className="text-sm text-slate-500">No members assigned.</p>
            )}

            {!isLoading && members.length > 0 && (
              <ul className="space-y-1">
                {members.map((member) => (
                  <li
                    key={member.uuid}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 group hover:bg-slate-50"
                  >
                    <Avatar.Root className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-slate-200">
                      <Avatar.Image
                        src={getImageUrl(member.image_path)}
                        alt={`${member.first_name} ${member.last_name}`}
                        className="h-full w-full object-cover"
                      />
                      <Avatar.Fallback className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-600">
                        {getInitials(member.first_name, member.last_name)}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-slate-900 truncate">{`${member.first_name} ${member.last_name}`}</p>
                        {leadId && member.uuid === leadId && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 flex-shrink-0">
                            Lead
                          </span>
                        )}
                      </div>
                      {member.title && (
                        <p className="text-xs text-slate-500 truncate">{member.title}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(member.uuid)}
                      className="rounded-md p-1 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                      title="Remove member"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
