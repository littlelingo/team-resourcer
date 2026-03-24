import { layoutTree } from '@/components/trees/useTreeLayout'
import type { TreeNode, TreeEdge } from '@/types/trees'

function makeNode(id: string, x = 0, y = 0): TreeNode {
  return { id, type: 'member', data: { name: id }, position: { x, y } }
}

function makeEdge(id: string, source: string, target: string): TreeEdge {
  return { id, source, target }
}

describe('layoutTree', () => {
  it('returns same array reference for empty nodes', () => {
    const input: TreeNode[] = []
    const result = layoutTree(input, [])
    expect(result).toBe(input)
  })

  it('positions a single node with numeric x and y', () => {
    const nodes = [makeNode('a')]
    const result = layoutTree(nodes, [])
    expect(typeof result[0].position.x).toBe('number')
    expect(typeof result[0].position.y).toBe('number')
  })

  it('positions parent-child pair vertically (TB direction) with parent above child', () => {
    const parent = makeNode('parent')
    const child = makeNode('child')
    const edge = makeEdge('e1', 'parent', 'child')
    const result = layoutTree([parent, child], [edge], 'TB')
    const parentResult = result.find(n => n.id === 'parent')!
    const childResult = result.find(n => n.id === 'child')!
    expect(parentResult.position.y).toBeLessThan(childResult.position.y)
  })

  it('positions parent-child pair horizontally (LR direction) with parent to the left', () => {
    const parent = makeNode('parent')
    const child = makeNode('child')
    const edge = makeEdge('e1', 'parent', 'child')
    const result = layoutTree([parent, child], [edge], 'LR')
    const parentResult = result.find(n => n.id === 'parent')!
    const childResult = result.find(n => n.id === 'child')!
    expect(parentResult.position.x).toBeLessThan(childResult.position.x)
  })

  it('preserves node data properties', () => {
    const nodes = [{ id: 'a', type: 'member', data: { name: 'Alice', role: 'dev' }, position: { x: 0, y: 0 } }]
    const result = layoutTree(nodes, [])
    expect(result[0].data).toEqual({ name: 'Alice', role: 'dev' })
  })

  it('ignores edges referencing non-existent nodes without throwing', () => {
    const nodes = [makeNode('a')]
    const edges = [makeEdge('bad', 'a', 'z'), makeEdge('bad2', 'x', 'y')]
    expect(() => layoutTree(nodes, edges)).not.toThrow()
    const result = layoutTree(nodes, edges)
    expect(typeof result[0].position.x).toBe('number')
    expect(typeof result[0].position.y).toBe('number')
  })

  it('handles multiple disconnected roots — all nodes get numeric positions', () => {
    const nodes = [makeNode('root1'), makeNode('root2'), makeNode('child1'), makeNode('child2')]
    const edges = [makeEdge('e1', 'root1', 'child1'), makeEdge('e2', 'root2', 'child2')]
    const result = layoutTree(nodes, edges)
    for (const node of result) {
      expect(typeof node.position.x).toBe('number')
      expect(typeof node.position.y).toBe('number')
    }
  })
})
