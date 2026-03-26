import { useState, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import ImportWizard from '@/components/import/ImportWizard'
import PageHeader from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PageError from '@/components/shared/PageError'
import AgencyFormDialog from '@/components/agencies/AgencyFormDialog'
import { getAgencyColumns } from '@/components/agencies/agencyColumns'
import { useAgencies, useDeleteAgency } from '@/hooks/useAgencies'
import type { Agency } from '@/types'

export default function AgenciesPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editAgency, setEditAgency] = useState<Agency | null>(null)
  const [deleteAgency, setDeleteAgency] = useState<Agency | null>(null)

  const agenciesQuery = useAgencies()
  const deleteMutation = useDeleteAgency()

  const columns = useMemo(
    () =>
      getAgencyColumns({
        onEdit: setEditAgency,
        onDelete: setDeleteAgency,
      }),
    [],
  )

  function handleDeleteConfirm() {
    if (!deleteAgency) return
    deleteMutation.mutate(deleteAgency.id, {
      onSuccess: () => {
        toast.success('Agency deleted')
        setDeleteAgency(null)
      },
      onError: (err) => {
        toast.error(err.message)
      },
    })
  }

  if (agenciesQuery.isError) {
    return (
      <PageError
        message={agenciesQuery.error.message}
        onRetry={() => void agenciesQuery.refetch()}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="Agencies"
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
              Add Agency
            </button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={agenciesQuery.data ?? []}
        loading={agenciesQuery.isLoading}
        emptyMessage="No agencies found. Add one to get started."
      />

      {/* Add dialog */}
      <AgencyFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {/* Edit dialog */}
      <AgencyFormDialog
        open={editAgency !== null}
        onOpenChange={(open) => { if (!open) setEditAgency(null) }}
        agency={editAgency ?? undefined}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteAgency !== null}
        onOpenChange={(open) => { if (!open) setDeleteAgency(null) }}
        title="Delete Agency"
        description={`Are you sure you want to delete "${deleteAgency?.name ?? ''}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        loading={deleteMutation.isPending}
      />

      {/* Import dialog */}
      <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-0 shadow-xl max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="sr-only">Import Agencies</Dialog.Title>
            <ImportWizard entityType="agency" onComplete={() => setImportOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
