import { useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import ImportWizard from '@/components/import/ImportWizard'
import PageHeader from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import EntityMembersSheet from '@/components/shared/EntityMembersSheet'
import PageError from '@/components/shared/PageError'
import ProgramFormDialog from '@/components/programs/ProgramFormDialog'
import { getProgramColumns } from '@/components/programs/programColumns'
import { usePrograms, useDeleteProgram, useProgramMembers, useAssignProgram, useUnassignProgram } from '@/hooks/usePrograms'
import { useMembers } from '@/hooks/useMembers'
import type { Program } from '@/types'

export default function ProgramsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editProgram, setEditProgram] = useState<Program | null>(null)
  const [deleteProgram, setDeleteProgram] = useState<Program | null>(null)
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null)

  const programsQuery = usePrograms()
  const deleteMutation = useDeleteProgram()
  const membersQuery = useProgramMembers(selectedProgram?.id ?? 0)
  const allMembersQuery = useMembers()
  const assignProgram = useAssignProgram()
  const unassignProgram = useUnassignProgram()

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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Import
            </button>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Add Program
            </button>
          </div>
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
      <EntityMembersSheet
        open={selectedProgram !== null}
        onOpenChange={(open) => { if (!open) setSelectedProgram(null) }}
        title={selectedProgram?.name ?? ''}
        members={membersQuery.data ?? []}
        isLoading={membersQuery.isLoading}
        allMembers={allMembersQuery.data ?? []}
        onAdd={(uuid) => {
          if (!selectedProgram) return
          assignProgram.mutate(
            { programId: selectedProgram.id, memberUuid: uuid },
            { onError: (err) => toast.error(err.message) },
          )
        }}
        onRemove={(uuid) => {
          if (!selectedProgram) return
          unassignProgram.mutate(
            { programId: selectedProgram.id, memberUuid: uuid },
            { onError: (err) => toast.error(err.message) },
          )
        }}
      />

      {/* Import dialog */}
      <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-0 shadow-xl max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="sr-only">Import Programs</Dialog.Title>
            <ImportWizard entityType="program" onComplete={() => setImportOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
