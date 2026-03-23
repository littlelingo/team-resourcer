import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'

export type TeamNodeData = {
  id: number
  name: string
  lead_name?: string | null
}

export type TeamNodeType = Node<TeamNodeData, 'team'>

export default function TeamNode({ data }: NodeProps<TeamNodeType>) {
  return (
    <div className="w-[200px] rounded-lg border border-amber-200 bg-amber-50 shadow-sm">
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      <div className="p-3">
        <p className="text-sm font-bold text-amber-900">{data.name}</p>
        {data.lead_name && (
          <p className="mt-1 text-xs text-amber-700">Lead: {data.lead_name}</p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
