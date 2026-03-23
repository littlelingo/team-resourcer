import { useMemo } from 'react'
import { Graph } from '@dagrejs/graphlib'
import { layout } from '@dagrejs/dagre'
import type { TreeNode, TreeEdge } from '@/types/trees'

const NODE_WIDTH = 220
const NODE_HEIGHT = 90

export function layoutTree(
  nodes: TreeNode[],
  edges: TreeEdge[],
  direction: 'TB' | 'LR' = 'TB',
): TreeNode[] {
  if (nodes.length === 0) return nodes

  const g = new Graph()
  g.setGraph({
    rankdir: direction,
    ranksep: 80,
    nodesep: 60,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }

  const nodeIds = new Set(nodes.map((n) => n.id))
  for (const edge of edges) {
    if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      g.setEdge(edge.source, edge.target)
    }
  }

  layout(g)

  return nodes.map((node) => {
    const positioned = g.node(node.id) as { x: number; y: number } | undefined
    if (!positioned) return node
    return {
      ...node,
      position: {
        x: positioned.x - NODE_WIDTH / 2,
        y: positioned.y - NODE_HEIGHT / 2,
      },
    }
  })
}

export function useTreeLayout(
  nodes: TreeNode[],
  edges: TreeEdge[],
  direction: 'TB' | 'LR' = 'TB',
): TreeNode[] {
  return useMemo(
    () => layoutTree(nodes, edges, direction),
    [nodes, edges, direction],
  )
}
