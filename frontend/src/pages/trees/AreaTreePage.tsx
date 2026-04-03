import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as Select from '@radix-ui/react-select'
import { ChevronDown, Check } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useFunctionalAreas } from '@/hooks/useFunctionalAreas'
import { useAreaTree } from '@/hooks/useTrees'
import { useTreeLayout } from '@/components/trees/useTreeLayout'
import { useTreeSearch } from '@/components/trees/useTreeSearch'
import { useDragReassign } from '@/components/trees/useDragReassign'
import TreeCanvas from '@/components/trees/TreeCanvas'
import TreeSearchBar from '@/components/trees/panels/TreeSearchBar'
import ReassignConfirmDialog from '@/components/trees/panels/ReassignConfirmDialog'
import MemberDetailPanel from '@/components/trees/panels/MemberDetailPanel'
import MemberNode from '@/components/trees/nodes/MemberNode'
import AreaNode from '@/components/trees/nodes/AreaNode'
import TeamNode from '@/components/trees/nodes/TeamNode'
import type { NodeTypes } from '@xyflow/react'

const nodeTypes: NodeTypes = {
  area: AreaNode,
  team: TeamNode,
  member: MemberNode,
}

export default function AreaTreePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  const numericId = id ? parseInt(id, 10) : 0

  const { data: areas, isLoading: areasLoading } = useFunctionalAreas()
  const { data, isLoading: treeLoading } = useAreaTree(numericId)

  const rawNodes = data?.nodes ?? []
  const rawEdges = data?.edges ?? []

  const layoutNodes = useTreeLayout(rawNodes, rawEdges, 'TB')
  const searchedNodes = useTreeSearch(layoutNodes, searchQuery)

  const { pendingReassign, confirmReassign, cancelReassign, handleNodeDragStop } = useDragReassign(
    'area',
    () => void queryClient.invalidateQueries({ queryKey: ['area-tree', numericId] }),
  )

  const nodesWithSelect = searchedNodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onSelect: (node.type === 'member' || node.type === 'team') ? (uuid: string) => setSelectedMemberId(uuid) : undefined,
    },
  }))

  function handleAreaChange(value: string) {
    navigate(`/tree/areas/${value}`)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 pt-4 pb-2 flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">Area Tree</h1>

        <Select.Root
          value={id ?? ''}
          onValueChange={handleAreaChange}
          disabled={areasLoading}
        >
          <Select.Trigger
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
            aria-label="Select area"
          >
            <Select.Value placeholder="Select an area..." />
            <Select.Icon>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </Select.Icon>
          </Select.Trigger>

          <Select.Portal>
            <Select.Content
              className="z-50 min-w-[200px] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
              position="popper"
              sideOffset={4}
            >
              <Select.Viewport className="p-1">
                {(areas ?? []).map((area) => (
                  <Select.Item
                    key={area.id}
                    value={String(area.id)}
                    className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-3 text-sm text-slate-700 outline-none hover:bg-slate-100 focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                  >
                    <Select.ItemIndicator className="absolute left-2 flex items-center">
                      <Check className="h-3.5 w-3.5" />
                    </Select.ItemIndicator>
                    <Select.ItemText>{area.name}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </div>

      {!numericId ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-slate-500">Select an area to view its tree</p>
            <p className="mt-1 text-sm text-slate-400">Use the dropdown above to choose a functional area</p>
          </div>
        </div>
      ) : treeLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        </div>
      ) : (
        <div className="flex-1 relative">
          <TreeCanvas
            nodes={nodesWithSelect}
            edges={rawEdges}
            nodeTypes={nodeTypes}
            onNodeDragStop={handleNodeDragStop}
          >
            <TreeSearchBar value={searchQuery} onChange={setSearchQuery} />
          </TreeCanvas>
        </div>
      )}

      <ReassignConfirmDialog
        open={pendingReassign !== null}
        onConfirm={() => void confirmReassign()}
        onCancel={cancelReassign}
        draggedNode={pendingReassign?.draggedNode ?? null}
        targetNode={pendingReassign?.targetNode ?? null}
        verb={pendingReassign?.targetNode?.type === 'area' ? 'unassign from team in' : 'move to team'}
      />

      <MemberDetailPanel
        memberId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
      />
    </div>
  )
}
