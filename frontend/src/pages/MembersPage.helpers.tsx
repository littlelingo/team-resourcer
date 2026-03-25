import MemberDetailSheet from '@/components/members/MemberDetailSheet'
import { useMember } from '@/hooks/useMembers'
import type { TeamMember } from '@/types'

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
      <div className="flex flex-col items-center">
        <div className="mb-3 h-16 w-16 rounded-full bg-slate-200" />
        <div className="h-3.5 w-24 rounded bg-slate-200" />
        <div className="mt-2 h-3 w-16 rounded bg-slate-100" />
      </div>
      <div className="mt-3 flex justify-center gap-1">
        <div className="h-4 w-14 rounded-full bg-slate-100" />
        <div className="h-4 w-12 rounded-full bg-slate-100" />
      </div>
    </div>
  )
}

export function MemberDetailSheetWrapper({
  uuid,
  open,
  onOpenChange,
  onEdit,
}: {
  uuid: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (member: TeamMember) => void
}) {
  const { data: member = null } = useMember(uuid ?? '')
  return (
    <MemberDetailSheet
      member={member}
      open={open}
      onOpenChange={onOpenChange}
      onEdit={onEdit}
    />
  )
}
