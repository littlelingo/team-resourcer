import { renderHook } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useTreeSearch } from '@/components/trees/useTreeSearch'

function makeNode(id: string, name: string): Node {
  return { id, type: 'default', position: { x: 0, y: 0 }, data: { name } }
}

const alice = makeNode('1', 'Alice')
const bob = makeNode('2', 'Bob')
const nodes = [alice, bob]

describe('useTreeSearch', () => {
  it('returns same nodes array reference when query is empty string', () => {
    const { result } = renderHook(() => useTreeSearch(nodes, ''))
    expect(result.current).toBe(nodes)
  })

  it('returns same nodes array reference when query is whitespace only', () => {
    const { result } = renderHook(() => useTreeSearch(nodes, '   '))
    expect(result.current).toBe(nodes)
  })

  it('removes opacity from style for matching node', () => {
    const nodesWithOpacity: Node[] = [
      { ...alice, style: { opacity: 0.2, color: 'red' } },
      bob,
    ]
    const { result } = renderHook(() => useTreeSearch(nodesWithOpacity, 'alice'))
    const aliceResult = result.current.find(n => n.id === '1')!
    expect(aliceResult.style).not.toHaveProperty('opacity')
  })

  it('sets opacity 0.2 on non-matching nodes', () => {
    const { result } = renderHook(() => useTreeSearch(nodes, 'alice'))
    const bobResult = result.current.find(n => n.id === '2')!
    expect(bobResult.style?.opacity).toBe(0.2)
  })

  it('search is case-insensitive — lowercase query matches capitalized name', () => {
    const { result } = renderHook(() => useTreeSearch(nodes, 'alice'))
    const aliceResult = result.current.find(n => n.id === '1')!
    expect(aliceResult.style).not.toHaveProperty('opacity')
  })

  it('partial name match works — "ali" matches "Alice"', () => {
    const { result } = renderHook(() => useTreeSearch(nodes, 'ali'))
    const aliceResult = result.current.find(n => n.id === '1')!
    expect(aliceResult.style).not.toHaveProperty('opacity')
  })

  it('dims all nodes when no match found', () => {
    const { result } = renderHook(() => useTreeSearch(nodes, 'zzz'))
    for (const node of result.current) {
      expect(node.style?.opacity).toBe(0.2)
    }
  })

  it('treats nodes with no data.name as non-matching and dims them', () => {
    const noNameNode: Node = { id: '3', type: 'default', position: { x: 0, y: 0 }, data: {} }
    const { result } = renderHook(() => useTreeSearch([noNameNode], 'alice'))
    expect(result.current[0].style?.opacity).toBe(0.2)
  })
})
