import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMembers } from '@/hooks/useMembers'
import { useCalibrationHistory } from '@/hooks/useCalibrationHistory'
import ComparisonRadar from './widgets/ComparisonRadar'
import type { RadarMember } from './widgets/ComparisonRadar'
import type { Calibration } from '@/api/calibrationApi'

const MAX_COMPARE = 4

interface MemberCompareCardProps {
  name: string
  calibrations: Calibration[]
}

function MemberCompareCard({ name, calibrations }: MemberCompareCardProps) {
  const latest = calibrations[0]
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
      <p className="font-medium text-sm text-slate-900">{name}</p>
      {latest ? (
        <>
          <p className="text-xs text-slate-500">
            Box {latest.box} — {latest.label} ({latest.cycle.label})
          </p>
          {latest.rationale && (
            <p className="text-xs text-slate-400 italic line-clamp-2">&ldquo;{latest.rationale}&rdquo;</p>
          )}
          <div className="flex flex-wrap gap-1 pt-1">
            {latest.ready_for_promotion && (
              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                {latest.ready_for_promotion}
              </span>
            )}
            {latest.can_mentor_juniors && (
              <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-xs text-violet-600">
                Mentor: {latest.can_mentor_juniors}
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-xs text-slate-400">No calibration data</p>
      )}
    </div>
  )
}

function LoadedMemberCompareCard({ uuid }: { uuid: string }) {
  const { data: history = [] } = useCalibrationHistory(uuid)
  const { data: members = [] } = useMembers()
  const member = members.find((m) => m.uuid === uuid)
  const name = member ? `${member.first_name} ${member.last_name}` : uuid.slice(0, 8)
  return <MemberCompareCard name={name} calibrations={history} />
}

/**
 * Fetches calibration history for up to 4 members (fixed hooks, padded with empty string).
 * Renders ComparisonRadar when ≥2 members have history.
 */
function SelectedMembersRadar({ uuids }: { uuids: string[] }) {
  const { data: members = [] } = useMembers()
  // Always call 4 hooks to satisfy Rules of Hooks — pad with '' which returns empty array
  const h0 = useCalibrationHistory(uuids[0] ?? '')
  const h1 = useCalibrationHistory(uuids[1] ?? '')
  const h2 = useCalibrationHistory(uuids[2] ?? '')
  const h3 = useCalibrationHistory(uuids[3] ?? '')

  const allHistories = [h0.data ?? [], h1.data ?? [], h2.data ?? [], h3.data ?? []]

  const radarMembers: RadarMember[] = uuids
    .map((uuid, i) => {
      const history = allHistories[i] ?? []
      const latest = history[0]
      if (!latest) return null
      const member = members.find((m) => m.uuid === uuid)
      const name = member ? `${member.first_name} ${member.last_name}` : uuid.slice(0, 8)
      return { uuid, name, calibrations: history, latestBox: latest.box }
    })
    .filter((m): m is RadarMember => m !== null)

  if (radarMembers.length < 2) return null
  return <ComparisonRadar members={radarMembers} />
}

interface CompareDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CompareDrawer({ open, onOpenChange }: CompareDrawerProps) {
  const [selectedUuids, setSelectedUuids] = useState<string[]>([])
  const { data: members = [] } = useMembers()

  function toggle(uuid: string) {
    setSelectedUuids((prev) => {
      if (prev.includes(uuid)) return prev.filter((u) => u !== uuid)
      if (prev.length >= MAX_COMPARE) return prev
      return [...prev, uuid]
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 z-50 h-full w-[520px]',
            'border-l border-slate-200 bg-white shadow-xl',
            'flex flex-col',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
            'duration-300',
          )}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <Dialog.Title className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Compare Members
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Member multi-select */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2">
                Select 2–4 members ({selectedUuids.length}/{MAX_COMPARE} selected)
              </p>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-md border border-slate-200 p-2">
                {members.map((m) => {
                  const isSelected = selectedUuids.includes(m.uuid)
                  const isDisabled = !isSelected && selectedUuids.length >= MAX_COMPARE
                  return (
                    <label
                      key={m.uuid}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50',
                        isDisabled && 'opacity-40 cursor-not-allowed',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => toggle(m.uuid)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-sm text-slate-700">
                        {m.first_name} {m.last_name}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Radar + cards */}
            {selectedUuids.length >= 2 && (
              <div className="space-y-4">
                <SelectedMembersRadar uuids={selectedUuids} />
                <div className="grid grid-cols-2 gap-3">
                  {selectedUuids.map((uuid) => (
                    <LoadedMemberCompareCard key={uuid} uuid={uuid} />
                  ))}
                </div>
              </div>
            )}

            {selectedUuids.length < 2 && (
              <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm text-slate-400">
                Select 2–4 members to compare
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
