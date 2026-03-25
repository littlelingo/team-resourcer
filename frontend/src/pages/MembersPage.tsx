import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { LayoutGrid, Table2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import SearchFilterBar from '@/components/shared/SearchFilterBar'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import DataTable from '@/components/shared/DataTable'
import PageError from '@/components/shared/PageError'
import MemberCard from '@/components/members/MemberCard'
import MemberFormDialog from '@/components/members/MemberFormDialog'
import { SkeletonCard, MemberDetailSheetWrapper } from '@/pages/MembersPage.helpers'
import { buildMemberColumns } from '@/components/members/memberColumns'
import { useMembers, useMember, useDeleteMember } from '@/hooks/useMembers'
import { usePrograms } from '@/hooks/usePrograms'
import { useFunctionalAreas } from '@/hooks/useFunctionalAreas'
import { useTeams } from '@/hooks/useTeams'
import type { TeamMember, TeamMemberList } from '@/types'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // URL params
  const search = searchParams.get('search') ?? ''
  const programId = searchParams.get('program_id') ?? ''
  const areaId = searchParams.get('area_id') ?? ''
  const teamId = searchParams.get('team_id') ?? ''

  // Runtime guard for view param — prevent arbitrary cast
  const rawView = searchParams.get('view')
  const view: 'card' | 'table' = rawView === 'table' ? 'table' : 'card'

  // Local UI state
  const [detailUuid, setDetailUuid] = useState<string | null>(null)
  const [editMember, setEditMember] = useState<TeamMember | null>(null)
  const [pendingEditUuid, setPendingEditUuid] = useState<string | null>(null)
  const [deleteMember, setDeleteMember] = useState<TeamMemberList | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  // Fetch full member when an edit is triggered from the table
  const { data: pendingEditData } = useMember(pendingEditUuid ?? '')

  useEffect(() => {
    if (pendingEditData && pendingEditUuid) {
      setEditMember(pendingEditData)
      setPendingEditUuid(null)
    }
  }, [pendingEditData, pendingEditUuid])

  // Param helpers
  function setParam(key: string, value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) {
        next.set(key, value)
      } else {
        next.delete(key)
      }
      return next
    })
  }

  // Data
  const queryParams: Record<string, string> = {}
  if (programId) queryParams.program_id = programId
  if (areaId) queryParams.area_id = areaId
  if (teamId) queryParams.team_id = teamId

  const { data: members = [], isLoading, isError, error } = useMembers(
    Object.keys(queryParams).length ? queryParams : undefined,
  )
  const { data: programs = [] } = usePrograms()
  const { data: areas = [] } = useFunctionalAreas()
  const { data: teams = [] } = useTeams()

  const deleteMutation = useDeleteMember()

  // Client-side search filter
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return members
    const q = search.toLowerCase()
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.title && m.title.toLowerCase().includes(q)),
    )
  }, [members, search])

  // Columns — table edit triggers a full-member fetch before opening the form
  const columns = useMemo(
    () =>
      buildMemberColumns({
        onEdit: (m) => {
          setPendingEditUuid(m.uuid)
        },
        onDelete: (m) => setDeleteMember(m),
      }),
    [],
  )

  async function handleDelete() {
    if (!deleteMember) return
    try {
      await deleteMutation.mutateAsync(deleteMember.uuid)
      toast.success('Member deleted')
      setDeleteMember(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (isError) {
    return <PageError message={error instanceof Error ? error.message : 'Failed to load members'} />
  }

  return (
    <div>
      <PageHeader
        title="Members"
        actions={
          <>
            {/* View toggle */}
            <ToggleGroup.Root
              type="single"
              value={view}
              onValueChange={(v) => {
                if (v) setParam('view', v)
              }}
              className="flex rounded-md border border-slate-200 bg-white p-0.5"
            >
              <ToggleGroup.Item
                value="card"
                aria-label="Card view"
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-sm text-slate-500 transition-colors',
                  'hover:bg-slate-100 hover:text-slate-700',
                  'data-[state=on]:bg-slate-900 data-[state=on]:text-white',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                )}
              >
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroup.Item>
              <ToggleGroup.Item
                value="table"
                aria-label="Table view"
                className={cn(
                  'inline-flex h-7 w-7 items-center justify-center rounded-sm text-slate-500 transition-colors',
                  'hover:bg-slate-100 hover:text-slate-700',
                  'data-[state=on]:bg-slate-900 data-[state=on]:text-white',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
                )}
              >
                <Table2 className="h-4 w-4" />
              </ToggleGroup.Item>
            </ToggleGroup.Root>

            {/* Add button */}
            <button
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              <Plus className="h-4 w-4" />
              Add Member
            </button>
          </>
        }
      />

      {/* Filters */}
      <div className="mb-6">
        <SearchFilterBar
          search={search}
          onSearchChange={(v) => setParam('search', v)}
          filters={[
            {
              key: 'program_id',
              label: 'Program',
              value: programId,
              options: programs.map((p) => ({ label: p.name, value: String(p.id) })),
              onChange: (v) => setParam('program_id', v),
            },
            {
              key: 'area_id',
              label: 'Functional Area',
              value: areaId,
              options: areas.map((a) => ({ label: a.name, value: String(a.id) })),
              onChange: (v) => setParam('area_id', v),
            },
            {
              key: 'team_id',
              label: 'Team',
              value: teamId,
              options: teams.map((t) => ({ label: t.name, value: String(t.id) })),
              onChange: (v) => setParam('team_id', v),
            },
          ]}
        />
      </div>

      {/* Card / Table view */}
      {view === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : filteredMembers.map((member) => (
                <MemberCard
                  key={member.uuid}
                  member={member as Parameters<typeof MemberCard>[0]['member']}
                  onClick={(m) => setDetailUuid(m.uuid)}
                  onEdit={(m) => setPendingEditUuid(m.uuid)}
                  onDelete={(m) => setDeleteMember(m)}
                />
              ))}
          {!isLoading && filteredMembers.length === 0 && (
            <div className="col-span-full py-16 text-center text-sm text-slate-500">
              No members found.
            </div>
          )}
        </div>
      ) : (
        <DataTable
          columns={columns as Parameters<typeof DataTable>[0]['columns']}
          data={filteredMembers as Parameters<typeof DataTable>[0]['data']}
          loading={isLoading}
          emptyMessage="No members found."
        />
      )}

      {/* Detail sheet */}
      <MemberDetailSheetWrapper
        uuid={detailUuid}
        open={Boolean(detailUuid)}
        onOpenChange={(o) => {
          if (!o) setDetailUuid(null)
        }}
        onEdit={(m) => {
          setEditMember(m)
          setDetailUuid(null)
        }}
      />

      {/* Single add/edit form dialog */}
      <MemberFormDialog
        open={addOpen || Boolean(editMember)}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false)
            setEditMember(null)
          }
        }}
        member={editMember ?? undefined}
        onSuccess={() => {
          setAddOpen(false)
          setEditMember(null)
        }}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={Boolean(deleteMember)}
        onOpenChange={(o) => {
          if (!o) setDeleteMember(null)
        }}
        title="Delete Member"
        description={
          deleteMember
            ? `Are you sure you want to delete ${deleteMember.name}? This action cannot be undone.`
            : 'Are you sure?'
        }
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
