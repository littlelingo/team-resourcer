import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PageError from '@/components/shared/PageError'
import FunctionalAreaFormDialog from '@/components/functional-areas/FunctionalAreaFormDialog'
import { getFunctionalAreaColumns } from '@/components/functional-areas/functionalAreaColumns'
import { useFunctionalAreas, useDeleteFunctionalArea } from '@/hooks/useFunctionalAreas'
import type { FunctionalArea } from '@/types'

export default function FunctionalAreasPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [editArea, setEditArea] = useState<FunctionalArea | null>(null)
  const [deleteArea, setDeleteArea] = useState<FunctionalArea | null>(null)

  const areasQuery = useFunctionalAreas()
  const deleteMutation = useDeleteFunctionalArea()

  const columns = useMemo(
    () =>
      getFunctionalAreaColumns({
        onEdit: setEditArea,
        onDelete: setDeleteArea,
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
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Add Area
          </button>
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
    </div>
  )
}
