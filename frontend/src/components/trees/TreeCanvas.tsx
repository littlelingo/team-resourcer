import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
} from '@xyflow/react'
import type { Node, Edge, NodeMouseHandler, OnNodeDrag, NodeTypes } from '@xyflow/react'

interface TreeCanvasProps {
  nodes: Node[]
  edges: Edge[]
  nodeTypes: NodeTypes
  onNodeClick?: NodeMouseHandler
  onNodeDragStop?: OnNodeDrag
  className?: string
  children?: React.ReactNode
}

export default function TreeCanvas({
  nodes,
  edges,
  nodeTypes,
  onNodeClick,
  onNodeDragStop,
  className,
  children,
}: TreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <div className={`relative h-[calc(100vh-4rem)] ${className ?? ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          fitView
          minZoom={0.1}
          maxZoom={2}
        >
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        </ReactFlow>
        {children}
      </div>
    </ReactFlowProvider>
  )
}
