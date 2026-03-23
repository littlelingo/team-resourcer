import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api-client'
import type { Node, Edge } from '@xyflow/react'

export interface PendingReassign {
  draggedNode: Node
  targetNode: Node
}

const SNAP_DISTANCE = 60

function getNodeCenter(node: Node): { x: number; y: number } {
  const width = (node.measured?.width ?? node.width ?? 220) as number
  const height = (node.measured?.height ?? node.height ?? 90) as number
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2,
  }
}

function getDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2))
}

function isValidTarget(
  treeType: 'org' | 'program' | 'area',
  draggedNode: Node,
  candidateNode: Node,
): boolean {
  if (candidateNode.id === draggedNode.id) return false
  switch (treeType) {
    case 'org':
      return candidateNode.type === 'member'
    case 'program':
      return candidateNode.type === 'program'
    case 'area':
      return candidateNode.type === 'team' || candidateNode.type === 'area'
  }
}

export function useDragReassign(
  treeType: 'org' | 'program' | 'area',
  onSuccess: () => void,
) {
  const [pendingReassign, setPendingReassign] = useState<PendingReassign | null>(null)
  const edgesRef = useRef<Edge[]>([])

  function setEdges(edges: Edge[]) {
    edgesRef.current = edges
  }

  function handleNodeDragStop(_event: React.MouseEvent, draggedNode: Node, nodes: Node[]) {
    const draggedCenter = getNodeCenter(draggedNode)

    let closestNode: Node | null = null
    let closestDistance = Infinity

    for (const node of nodes) {
      if (!isValidTarget(treeType, draggedNode, node)) continue
      const center = getNodeCenter(node)
      const dist = getDistance(draggedCenter, center)
      if (dist < closestDistance) {
        closestDistance = dist
        closestNode = node
      }
    }

    if (closestNode && closestDistance <= SNAP_DISTANCE) {
      setPendingReassign({ draggedNode, targetNode: closestNode })
    } else {
      onSuccess()
    }
  }

  async function confirmReassign() {
    if (!pendingReassign) return

    const { draggedNode, targetNode } = pendingReassign
    const edges = edgesRef.current
    const draggedUuid = draggedNode.data?.uuid as string | undefined
    const targetData = targetNode.data

    try {
      switch (treeType) {
        case 'org': {
          const supervisorUuid = targetData?.uuid as string
          await apiFetch(`/api/org/members/${draggedUuid}/supervisor`, {
            method: 'PUT',
            body: JSON.stringify({ supervisor_id: supervisorUuid }),
          })
          break
        }
        case 'program': {
          const programId = targetData?.id as number
          // Find the old program from edges and delete that assignment first
          const oldEdge = edges.find(
            (e) => e.target === draggedNode.id && e.source.startsWith('program-'),
          )
          if (oldEdge) {
            const oldProgramId = oldEdge.source.replace('program-', '')
            await apiFetch(`/api/programs/${oldProgramId}/assignments/${draggedUuid}`, {
              method: 'DELETE',
            })
          }
          await apiFetch(`/api/programs/${programId}/assignments`, {
            method: 'POST',
            body: JSON.stringify({ member_uuid: draggedUuid, program_id: programId }),
          })
          break
        }
        case 'area': {
          const teamId = targetNode.type === 'team' ? (targetData?.id as number) : null
          await apiFetch(`/api/members/${draggedUuid}`, {
            method: 'PUT',
            body: JSON.stringify({ team_id: teamId }),
          })
          break
        }
      }
      onSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reassignment failed')
    } finally {
      setPendingReassign(null)
    }
  }

  function cancelReassign() {
    setPendingReassign(null)
  }

  return { pendingReassign, confirmReassign, cancelReassign, handleNodeDragStop, setEdges }
}
