import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'

export type ProgramNodeData = {
  id: number
  name: string
  description?: string | null
}

export type ProgramNodeType = Node<ProgramNodeData, 'program'>

export default function ProgramNode({ data }: NodeProps<ProgramNodeType>) {
  return (
    <div className="w-[200px] rounded-lg border border-blue-200 bg-blue-50 shadow-sm">
      <div className="p-3">
        <p className="text-sm font-bold text-blue-900">{data.name}</p>
        {data.description && (
          <p className="mt-1 line-clamp-2 text-xs text-blue-700">{data.description}</p>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
