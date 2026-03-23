export interface TreeNodePosition {
  x: number
  y: number
}

export interface TreeNodeData {
  [key: string]: unknown
}

export interface TreeNode {
  id: string
  type: string
  data: TreeNodeData
  position: TreeNodePosition
}

export interface TreeEdge {
  id: string
  source: string
  target: string
}

export interface TreeData {
  nodes: TreeNode[]
  edges: TreeEdge[]
}
