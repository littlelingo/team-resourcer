import { Handle, Position } from '@xyflow/react'
import type { NodeProps, Node } from '@xyflow/react'
import { getInitials } from '@/lib/member-utils'
import { getImageUrl } from '@/lib/api-client'

export type MemberNodeData = {
  uuid: string
  name: string
  title?: string | null
  image_path?: string | null
  role?: string | null
  onSelect?: (uuid: string) => void
}

export type MemberNodeType = Node<MemberNodeData, 'member'>

export default function MemberNode({ data }: NodeProps<MemberNodeType>) {
  const imageUrl = getImageUrl(data.image_path)

  function handleClick() {
    data.onSelect?.(data.uuid)
  }

  return (
    <div
      className="w-[200px] rounded-lg border border-slate-200 bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
      onClick={handleClick}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      <div className="flex items-center gap-3 p-3">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={data.name}
            className="h-10 w-10 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
            {getInitials(data.name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{data.name}</p>
          {data.title && (
            <p className="truncate text-xs text-slate-500">{data.title}</p>
          )}
          {data.role && (
            <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {data.role}
            </span>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}
