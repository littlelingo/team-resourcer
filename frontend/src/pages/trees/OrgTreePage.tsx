import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useOrgTree } from '@/hooks/useTrees'
import { useTreeLayout } from '@/components/trees/useTreeLayout'
import { useTreeSearch } from '@/components/trees/useTreeSearch'
import { useDragReassign } from '@/components/trees/useDragReassign'
import TreeCanvas from '@/components/trees/TreeCanvas'
import TreeSearchBar from '@/components/trees/panels/TreeSearchBar'
import ReassignConfirmDialog from '@/components/trees/panels/ReassignConfirmDialog'
import MemberDetailPanel from '@/components/trees/panels/MemberDetailPanel'
import MemberNode from '@/components/trees/nodes/MemberNode'
import type { NodeTypes } from '@xyflow/react'

const nodeTypes: NodeTypes = {
  member: MemberNode,
}

export default function OrgTreePage() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  const { data, isLoading } = useOrgTree()

  const rawNodes = data?.nodes ?? []
  const rawEdges = data?.edges ?? []

  const layoutNodes = useTreeLayout(rawNodes, rawEdges, 'TB')
  const searchedNodes = useTreeSearch(layoutNodes, searchQuery)

  const { pendingReassign, confirmReassign, cancelReassign, handleNodeDragStop } = useDragReassign(
    'org',
    () => void queryClient.invalidateQueries({ queryKey: ['org-tree'] }),
  )

  // Inject onSelect into member node data
  const nodesWithSelect = searchedNodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onSelect: node.type === 'member' ? (uuid: string) => setSelectedMemberId(uuid) : undefined,
    },
  }))

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="px-6 pt-4 pb-2">
        <h1 className="text-2xl font-semibold text-slate-900">Organization Chart</h1>
      </div>

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

      <ReassignConfirmDialog
        open={pendingReassign !== null}
        onConfirm={() => void confirmReassign()}
        onCancel={cancelReassign}
        draggedNode={pendingReassign?.draggedNode ?? null}
        targetNode={pendingReassign?.targetNode ?? null}
        verb="report to"
      />

      <MemberDetailPanel
        memberId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
      />
    </div>
  )
}
