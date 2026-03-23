import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import * as Separator from '@radix-ui/react-separator'
import { X, Mail, Phone, Hash, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getImageUrl } from '@/lib/api-client'
import { getInitials } from '@/lib/member-utils'
import { useMember } from '@/hooks/useMembers'

interface MemberDetailPanelProps {
  memberId: string | null
  onClose: () => void
}

export default function MemberDetailPanel({ memberId, onClose }: MemberDetailPanelProps) {
  const { data: member, isLoading } = useMember(memberId ?? '')

  const open = Boolean(memberId)

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 z-50 h-full w-[480px] sm:w-[540px]',
            'border-l border-slate-200 bg-white shadow-xl',
            'flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'duration-300',
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Member Details
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              </div>
            )}

            {member && (
              <>
                {/* Avatar + name */}
                <div className="flex items-center gap-4">
                  <Avatar.Root className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-slate-200">
                    <Avatar.Image
                      src={getImageUrl(member.image_path)}
                      alt={member.name}
                      className="h-full w-full object-cover"
                    />
                    <Avatar.Fallback className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-600">
                      {getInitials(member.name)}
                    </Avatar.Fallback>
                  </Avatar.Root>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-900 leading-tight">{member.name}</h2>
                    {member.title && (
                      <p className="mt-0.5 text-sm text-slate-500">{member.title}</p>
                    )}
                    <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {member.employee_id}
                    </span>
                  </div>
                </div>

                <Separator.Root className="h-px bg-slate-100" />

                {/* Contact */}
                {(member.email || member.phone || member.slack_handle || member.location) && (
                  <>
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Contact
                      </h3>
                      <div className="space-y-1.5">
                        {member.email && (
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Mail className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span className="truncate">{member.email}</span>
                          </div>
                        )}
                        {member.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Phone className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span>{member.phone}</span>
                          </div>
                        )}
                        {member.slack_handle && (
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <Hash className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span>{member.slack_handle}</span>
                          </div>
                        )}
                        {member.location && (
                          <div className="flex items-center gap-2 text-sm text-slate-700">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                            <span>{member.location}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator.Root className="h-px bg-slate-100" />
                  </>
                )}

                {/* Organization */}
                {(member.functional_area || member.team) && (
                  <>
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Organization
                      </h3>
                      <div className="space-y-1.5 text-sm text-slate-700">
                        {member.functional_area && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Area</span>
                            <span>{member.functional_area.name}</span>
                          </div>
                        )}
                        {member.team && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Team</span>
                            <span>{member.team.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Separator.Root className="h-px bg-slate-100" />
                  </>
                )}

                {/* Programs */}
                {member.program_assignments && member.program_assignments.length > 0 && (
                  <>
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Programs
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {member.program_assignments.map((pa, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
                          >
                            {pa.program?.name ?? `Program ${i + 1}`}
                            {pa.role && (
                              <span className="ml-1 text-blue-500">({pa.role})</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
