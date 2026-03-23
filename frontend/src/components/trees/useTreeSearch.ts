import { useMemo } from 'react'
import type { Node } from '@xyflow/react'

export function useTreeSearch(nodes: Node[], searchQuery: string): Node[] {
  return useMemo(() => {
    if (!searchQuery.trim()) {
      return nodes
    }

    const query = searchQuery.toLowerCase()

    return nodes.map((node) => {
      const name = (node.data?.name as string | undefined) ?? ''
      const matches = name.toLowerCase().includes(query)

      if (matches) {
        // Restore original style by removing opacity override if previously set
        const { opacity: _opacity, ...restStyle } = (node.style ?? {}) as Record<string, unknown>
        void _opacity
        return {
          ...node,
          style: { ...restStyle },
        }
      }

      return {
        ...node,
        style: { ...(node.style ?? {}), opacity: 0.2 },
      }
    })
  }, [nodes, searchQuery])
}
