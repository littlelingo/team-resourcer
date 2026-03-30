import { useState, useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-client'
import ImportWizard from '@/components/import/ImportWizard'
import { teamKeys } from '@/hooks/useTeams'
import PageHeader from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import EntityMembersSheet from '@/components/shared/EntityMembersSheet'
import PageError from '@/components/shared/PageError'
import TeamFormDialog from '@/components/teams/TeamFormDialog'
import { getTeamColumns } from '@/components/teams/teamColumns'
import { useFunctionalAreas } from '@/hooks/useFunctionalAreas'
import { useMembers } from '@/hooks/useMembers'
import { useDeleteTeam, useTeamMembers, useAddTeamMember, useRemoveTeamMember } from '@/hooks/useTeams'
import type { Team } from '@/types'

// Fetches teams for ALL functional areas by running one query per area.
function useAllTeams(areaIds: number[]) {
  const queries = useQueries({
    queries: areaIds.map((areaId) => ({
      queryKey: teamKeys.list(areaId),
      queryFn: () => apiFetch<Team[]>(`/api/areas/${areaId}/teams/`),
      enabled: areaId > 0,
    })),
  })

  const isLoading = queries.some((q) => q.isLoading)
  const isError = queries.some((q) => q.isError)
  const data = isLoading || isError
    ? undefined
    : queries.flatMap((q) => q.data ?? [])

  return { isLoading, isError, data }
}

export default function TeamsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editTeam, setEditTeam] = useState<Team | null>(null)
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)

  const areasQuery = useFunctionalAreas()
  const membersQuery = useMembers()

  const areaIds = useMemo(
    () => areasQuery.data?.map((a) => a.id) ?? [],
    [areasQuery.data],
  )

  const teamsResult = useAllTeams(areaIds)

  const selectedAreaId = selectedTeam?.functional_area_id ?? 0
  const teamMembersQuery = useTeamMembers(selectedTeam?.id ?? 0)
  const addTeamMember = useAddTeamMember(selectedAreaId)
  const removeTeamMember = useRemoveTeamMember(selectedAreaId)

  // Delete hook — area id is determined per team at click time.
  const deleteAreaId = deleteTeam?.functional_area_id ?? 0
  const deleteMutation = useDeleteTeam(deleteAreaId)

  const columns = useMemo(
    () =>
      getTeamColumns({
        areas: areasQuery.data ?? [],
        members: membersQuery.data ?? [],
        onEdit: setEditTeam,
        onDelete: setDeleteTeam,
        onSelect: setSelectedTeam,
      }),
    [areasQuery.data, membersQuery.data],
  )

  function handleDeleteConfirm() {
    if (!deleteTeam) return
    deleteMutation.mutate(deleteTeam.id, {
      onSuccess: () => {
        toast.success('Team deleted')
        setDeleteTeam(null)
      },
      onError: (err) => {
        toast.error(err.message)
      },
    })
  }

  const isLoading = areasQuery.isLoading || membersQuery.isLoading || teamsResult.isLoading
  const isError = areasQuery.isError || membersQuery.isError || teamsResult.isError
  const errorMessage =
    areasQuery.error?.message ??
    membersQuery.error?.message ??
    'Failed to load teams'

  if (isError) {
    return (
      <PageError
        message={errorMessage}
        onRetry={() => {
          void areasQuery.refetch()
          void membersQuery.refetch()
        }}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="Teams"
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
              Add Team
            </button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={teamsResult.data ?? []}
        loading={isLoading}
        emptyMessage="No teams found. Add one to get started."
      />

      {/* Add dialog */}
      <TeamFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {/* Edit dialog */}
      <TeamFormDialog
        open={editTeam !== null}
        onOpenChange={(open) => { if (!open) setEditTeam(null) }}
        team={editTeam ?? undefined}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteTeam !== null}
        onOpenChange={(open) => { if (!open) setDeleteTeam(null) }}
        title="Delete Team"
        description={`Are you sure you want to delete "${deleteTeam?.name ?? ''}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        loading={deleteMutation.isPending}
      />

      {/* Members sheet */}
      <EntityMembersSheet
        open={selectedTeam !== null}
        onOpenChange={(open) => { if (!open) setSelectedTeam(null) }}
        title={selectedTeam?.name ?? ''}
        members={teamMembersQuery.data ?? []}
        isLoading={teamMembersQuery.isLoading}
        allMembers={membersQuery.data ?? []}
        onAdd={(uuid) => {
          if (!selectedTeam) return
          addTeamMember.mutate(
            { teamId: selectedTeam.id, memberUuid: uuid },
            { onError: (err) => toast.error(err.message) },
          )
        }}
        onRemove={(uuid) => {
          if (!selectedTeam) return
          removeTeamMember.mutate(
            { teamId: selectedTeam.id, memberUuid: uuid },
            { onError: (err) => toast.error(err.message) },
          )
        }}
      />

      {/* Import dialog */}
      <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-0 shadow-xl max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="sr-only">Import Teams</Dialog.Title>
            <ImportWizard entityType="team" onComplete={() => setImportOpen(false)} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
