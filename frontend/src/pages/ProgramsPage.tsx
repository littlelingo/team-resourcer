import { useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Avatar from '@radix-ui/react-avatar'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { getImageUrl } from '@/lib/api-client'
import PageHeader from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PageError from '@/components/shared/PageError'
import ProgramFormDialog from '@/components/programs/ProgramFormDialog'
import { getProgramColumns } from '@/components/programs/programColumns'
import { usePrograms, useDeleteProgram, useProgramMembers } from '@/hooks/usePrograms'
import type { Program } from '@/types'

// ─── Members Sheet ────────────────────────────────────────────────────────────

function ProgramMembersSheet({
  program,
  onClose,
}: {
  program: Program | null
  onClose: () => void
}) {
  const membersQuery = useProgramMembers(program?.id ?? 0)

  return (
    <Dialog.Root open={program !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-80 bg-white shadow-xl flex flex-col data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right duration-300">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-slate-900">
              {program?.name ?? ''}
            </Dialog.Title>
            <Dialog.Close
              onClick={onClose}
              className="rounded-md p-1 text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
              Assigned Members
            </p>

            {membersQuery.isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />
                    <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {membersQuery.isError && (
              <p className="text-sm text-red-600">Failed to load members.</p>
            )}

            {membersQuery.data && membersQuery.data.length === 0 && (
              <p className="text-sm text-slate-500">No members assigned.</p>
            )}

            {membersQuery.data && membersQuery.data.length > 0 && (
              <ul className="space-y-2">
                {membersQuery.data.map((member) => (
                  <li key={member.uuid} className="flex items-center gap-3">
                    <Avatar.Root className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-slate-200">
                      <Avatar.Image
                        src={getImageUrl(member.image_path)}
                        alt={member.name}
                        className="h-full w-full object-cover"
                      />
                      <Avatar.Fallback className="flex h-full w-full items-center justify-center text-xs font-medium text-slate-600">
                        {member.name.slice(0, 2).toUpperCase()}
                      </Avatar.Fallback>
                    </Avatar.Root>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{member.name}</p>
                      {member.title && (
                        <p className="text-xs text-slate-500">{member.title}</p>
                      )}
                    </div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [editProgram, setEditProgram] = useState<Program | null>(null)
  const [deleteProgram, setDeleteProgram] = useState<Program | null>(null)
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)

  const programsQuery = usePrograms()
  const deleteMutation = useDeleteProgram()

  const columns = useMemo(
    () =>
      getProgramColumns({
        onEdit: setEditProgram,
        onDelete: setDeleteProgram,
        onSelect: setSelectedProgram,
      }),
    [],
  )

  function handleDeleteConfirm() {
    if (!deleteProgram) return
    deleteMutation.mutate(deleteProgram.id, {
      onSuccess: () => {
        toast.success('Program deleted')
        setDeleteProgram(null)
      },
      onError: (err) => {
        toast.error(err.message)
      },
    })
  }

  if (programsQuery.isError) {
    return (
      <PageError
        message={programsQuery.error.message}
        onRetry={() => void programsQuery.refetch()}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="Programs"
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Add Program
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={programsQuery.data ?? []}
        loading={programsQuery.isLoading}
        emptyMessage="No programs found. Add one to get started."
      />

      {/* Add dialog */}
      <ProgramFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {/* Edit dialog */}
      <ProgramFormDialog
        open={editProgram !== null}
        onOpenChange={(open) => { if (!open) setEditProgram(null) }}
        program={editProgram ?? undefined}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteProgram !== null}
        onOpenChange={(open) => { if (!open) setDeleteProgram(null) }}
        title="Delete Program"
        description={`Are you sure you want to delete "${deleteProgram?.name ?? ''}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        loading={deleteMutation.isPending}
      />

      {/* Members sheet */}
      <ProgramMembersSheet
        program={selectedProgram}
        onClose={() => setSelectedProgram(null)}
      />
    </div>
  )
}
