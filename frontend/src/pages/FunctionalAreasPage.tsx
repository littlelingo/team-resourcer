import { useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import ImportWizard from '@/components/import/ImportWizard'
import PageHeader from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import EntityMembersSheet from '@/components/shared/EntityMembersSheet'
import PageError from '@/components/shared/PageError'
import FunctionalAreaFormDialog from '@/components/functional-areas/FunctionalAreaFormDialog'
import { getFunctionalAreaColumns } from '@/components/functional-areas/functionalAreaColumns'
import { useFunctionalAreas, useDeleteFunctionalArea, useAreaMembers } from '@/hooks/useFunctionalAreas'
import { useMembers, useUpdateMember } from '@/hooks/useMembers'
import type { FunctionalArea } from '@/types'

export default function FunctionalAreasPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editArea, setEditArea] = useState<FunctionalArea | null>(null)
  const [deleteArea, setDeleteArea] = useState<FunctionalArea | null>(null)
  const [selectedArea, setSelectedArea] = useState<FunctionalArea | null>(null)

  const areasQuery = useFunctionalAreas()
  const deleteMutation = useDeleteFunctionalArea()
  const areaMembersQuery = useAreaMembers(selectedArea?.id ?? 0)
  const allMembersQuery = useMembers()
  const updateMember = useUpdateMember()

  // Find or assume an "Unassigned" area for removing members
  const unassignedArea = useMemo(
    () => areasQuery.data?.find((a) => a.name === 'Unassigned'),
    [areasQuery.data],
  )

  const columns = useMemo(
    () =>
      getFunctionalAreaColumns({
        onEdit: setEditArea,
        onDelete: setDeleteArea,
        onSelect: setSelectedArea,
      }),
    [],
  )

  function handleDeleteConfirm() {
    if (!deleteArea) return
    deleteMutation.mutate(deleteArea.id, {
      onSuccess: () => {
        toast.success('Functional area deleted')
        setDeleteArea(null)
      },
      onError: (err) => {
        toast.error(err.message)
      },
    })
  }

  if (areasQuery.isError) {
    return (
      <PageError
        message={areasQuery.error.message}
        onRetry={() => void areasQuery.refetch()}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="Functional Areas"
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
              Add Area
            </button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={areasQuery.data ?? []}
        loading={areasQuery.isLoading}
        emptyMessage="No functional areas found. Add one to get started."
      />

      {/* Add dialog */}
      <FunctionalAreaFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {/* Edit dialog */}
      <FunctionalAreaFormDialog
        open={editArea !== null}
        onOpenChange={(open) => { if (!open) setEditArea(null) }}
        area={editArea ?? undefined}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteArea !== null}
        onOpenChange={(open) => { if (!open) setDeleteArea(null) }}
        title="Delete Functional Area"
        description={`Are you sure you want to delete "${deleteArea?.name ?? ''}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        loading={deleteMutation.isPending}
      />

      {/* Members sheet */}
      <EntityMembersSheet
        open={selectedArea !== null}
        onOpenChange={(open) => { if (!open) setSelectedArea(null) }}
        title={selectedArea?.name ?? ''}
        members={areaMembersQuery.data ?? []}
        isLoading={areaMembersQuery.isLoading}
        allMembers={allMembersQuery.data ?? []}
        onAdd={(uuid) => {
          if (!selectedArea) return
          updateMember.mutate(
            { uuid, data: { functional_area_id: selectedArea.id } },
            {
              onSuccess: () => void areaMembersQuery.refetch(),
              onError: (err) => toast.error(err.message),
            },
          )
        }}
        onRemove={(uuid) => {
          if (!unassignedArea) {
            toast.error('Create an "Unassigned" functional area first')
            return
          }
          updateMember.mutate(
            { uuid, data: { functional_area_id: unassignedArea.id } },
            {
              onSuccess: () => void areaMembersQuery.refetch(),
              onError: (err) => toast.error(err.message),
            },
          )
        }}
      />

      {/* Import dialog */}
      <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-0 shadow-xl max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="sr-only">Import Functional Areas</Dialog.Title>
            <ImportWizard entityType="area" onComplete={() => setImportOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
