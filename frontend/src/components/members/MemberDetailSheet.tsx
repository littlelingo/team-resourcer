import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import * as Separator from '@radix-ui/react-separator'
import { X, Mail, Phone, Hash, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getImageUrl } from '@/lib/api-client'
import { getInitials } from '@/lib/member-utils'
import { formatCurrency, formatNumber } from '@/lib/format-utils'
import type { TeamMember } from '@/types'

/* Keep field list in sync with _FINANCIAL_FIELDS in backend/app/services/import_commit.py */
const HISTORY_FIELD_STYLES: Record<string, { label: string; dot: string; badge: string }> = {
  salary:   { label: 'Salary', dot: 'border-emerald-400 bg-emerald-50', badge: 'bg-emerald-50 text-emerald-700' },
  bonus:    { label: 'Bonus',  dot: 'border-violet-400 bg-violet-50',   badge: 'bg-violet-50 text-violet-700' },
  pto_used: { label: 'PTO',    dot: 'border-amber-400 bg-amber-50',     badge: 'bg-amber-50 text-amber-700' },
}
const DEFAULT_FIELD_STYLE = { label: '', dot: 'border-blue-300 bg-white', badge: 'bg-slate-100 text-slate-600' }

interface MemberDetailSheetProps {
  member: TeamMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (member: TeamMember) => void
}

export default function MemberDetailSheet({
  member,
  open,
  onOpenChange,
  onEdit,
}: MemberDetailSheetProps) {
  if (!member) return null

  const imageUrl = getImageUrl(member.image_path)
  const initials = getInitials(member.first_name, member.last_name)

  const sortedHistory = member.history
    ? [...member.history].sort(
        (a, b) => new Date(b.effective_date).getTime() - new Date(a.effective_date).getTime(),
      )
    : []

  const hasCompensation = member.salary || member.bonus || member.pto_used

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
          {/* Close button */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              Member Details
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* 1. Header */}
            <div className="flex items-center gap-4">
              <Avatar.Root className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-slate-200">
                <Avatar.Image
                  src={imageUrl}
                  alt={`${member.first_name} ${member.last_name}`}
                  className="h-full w-full object-cover"
                />
                <Avatar.Fallback className="flex h-full w-full items-center justify-center text-lg font-semibold text-slate-600">
                  {initials}
                </Avatar.Fallback>
              </Avatar.Root>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 leading-tight">{`${member.first_name} ${member.last_name}`}</h2>
                {member.title && (
                  <p className="mt-0.5 text-sm text-slate-500">{member.title}</p>
                )}
                <span className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Employee Id {member.employee_id}
                </span>
              </div>
            </div>

            <Separator.Root className="h-px bg-slate-100" />

            {/* 2. Contact */}
            {(member.email || member.phone || member.slack_handle || member.city || member.state) && (
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
                    {(member.city || member.state) && (
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        <span>{[member.city, member.state].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator.Root className="h-px bg-slate-100" />
              </>
            )}

            {/* 3. Organization */}
            {(member.functional_area || member.team || member.supervisor || member.functional_manager) && (
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
                    {member.supervisor && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Direct Manager</span>
                        <span>{member.supervisor.first_name} {member.supervisor.last_name}</span>
                      </div>
                    )}
                    {member.functional_manager && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Functional Manager</span>
                        <span>{member.functional_manager.first_name} {member.functional_manager.last_name}</span>
                      </div>
                    )}
                    {member.hire_date && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Hire Date</span>
                        <span>{new Date(member.hire_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator.Root className="h-px bg-slate-100" />
              </>
            )}

            {/* 4. Programs */}
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
                <Separator.Root className="h-px bg-slate-100" />
              </>
            )}

            {/* 5. Compensation */}
            {hasCompensation && (
              <>
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Compensation
                  </h3>
                  <div className="space-y-1.5 text-sm text-slate-700">
                    {member.salary && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Salary</span>
                        <span>{formatCurrency(member.salary) ?? member.salary}</span>
                      </div>
                    )}
                    {member.bonus && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Bonus</span>
                        <span>{formatCurrency(member.bonus) ?? member.bonus}</span>
                      </div>
                    )}
                    {member.pto_used && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">PTO Used</span>
                        <span>{(formatNumber(member.pto_used) ?? member.pto_used) + ' hrs'}</span>
                      </div>
                    )}
                  </div>
                </div>
                <Separator.Root className="h-px bg-slate-100" />
              </>
            )}

            {/* 6. History timeline */}
            {sortedHistory.length > 0 && (
              <>
                <div>
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    History
                  </h3>
                  <ol className="relative border-l-2 border-slate-200 space-y-4 pl-4">
                    {sortedHistory.map((entry) => {
                      const style = HISTORY_FIELD_STYLES[entry.field] ?? DEFAULT_FIELD_STYLE
                      return (
                        <li key={entry.id} className="relative">
                          <span className={cn('absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2', style.dot)} />
                          <p className="text-xs text-slate-400">
                            {new Date(entry.effective_date).toLocaleDateString()}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-700">
                            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium mr-1.5', style.badge)}>
                              {style.label || entry.field.replace(/_/g, ' ')}
                            </span>
                            {entry.field === 'salary' || entry.field === 'bonus'
                              ? (formatCurrency(entry.value) ?? entry.value)
                              : entry.field === 'pto_used'
                                ? `${formatNumber(entry.value) ?? entry.value} hrs`
                                : entry.value}
                          </p>
                          {entry.notes && (
                            <p className="mt-0.5 text-xs text-slate-400">{entry.notes}</p>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </div>
              </>
            )}
          </div>

          {/* Footer — Edit button */}
          <div className="border-t border-slate-100 px-6 py-4">
            <button
              onClick={() => onEdit(member)}
              className="w-full inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Edit Member
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
