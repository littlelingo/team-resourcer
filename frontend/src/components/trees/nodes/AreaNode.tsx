import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'

export type AreaNodeData = {
  id: number
  name: string
}

export type AreaNodeType = Node<AreaNodeData, 'area'>

export default function AreaNode({ data }: NodeProps<AreaNodeType>) {
  return (
    <div className="w-[200px] rounded-lg border border-green-200 bg-green-50 shadow-sm">
      <div className="p-3">
        <p className="text-sm font-bold text-green-900">{data.name}</p>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
