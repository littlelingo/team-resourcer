import { renderHook, act } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { Node } from '@xyflow/react'
import { useDragReassign } from '@/components/trees/useDragReassign'
import { server } from '@/test/msw/server'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Nodes positioned so their centers are within SNAP_DISTANCE (60) of each other.
// Center = position + width/2, height/2. Default size is 220x90.
// node1 center: (100 + 110, 100 + 45) = (210, 145)
// node2 center: (130 + 110, 130 + 45) = (240, 175)
// distance = sqrt((240-210)^2 + (175-145)^2) = sqrt(900 + 900) = ~42.4 — within 60

const memberNode1: Node = {
  id: 'n1',
  type: 'member',
  position: { x: 100, y: 100 },
  data: { uuid: 'uuid-1', name: 'Alice' },
}
const memberNode2: Node = {
  id: 'n2',
  type: 'member',
  position: { x: 130, y: 130 },
  data: { uuid: 'uuid-2', name: 'Bob', id: 2 },
}

// Faraway node — center at (1000 + 110, 1000 + 45) = (1110, 1045), far from memberNode1
const farMemberNode: Node = {
  id: 'n3',
  type: 'member',
  position: { x: 1000, y: 1000 },
  data: { uuid: 'uuid-3', name: 'Charlie' },
}

const programNode: Node = {
  id: 'n4',
  type: 'program',
  position: { x: 130, y: 130 },
  data: { uuid: 'uuid-4', name: 'Alpha Program', id: 1 },
}

const teamNode: Node = {
  id: 'n5',
  type: 'team',
  position: { x: 130, y: 130 },
  data: { uuid: 'uuid-5', name: 'Team Alpha', id: 5 },
}


const mockMouseEvent = {} as React.MouseEvent

describe('handleNodeDragStop', () => {
  it('sets pendingReassign when dragged node is within SNAP_DISTANCE of a valid target', () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('org', onSuccess))

    act(() => {
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, memberNode2])
    })

    expect(result.current.pendingReassign).not.toBeNull()
    expect(result.current.pendingReassign?.draggedNode.id).toBe('n1')
    expect(result.current.pendingReassign?.targetNode.id).toBe('n2')
    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('does not set pendingReassign when closest valid node is beyond SNAP_DISTANCE', () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('org', onSuccess))

    act(() => {
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, farMemberNode])
    })

    expect(result.current.pendingReassign).toBeNull()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('org tree: does not set pendingReassign when nearby node is not a member type', () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('org', onSuccess))

    act(() => {
      // programNode is nearby but org tree only targets 'member' type
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, programNode])
    })

    expect(result.current.pendingReassign).toBeNull()
    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('program tree: sets pendingReassign when dragged member is near a program node', () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('program', onSuccess))

    act(() => {
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, programNode])
    })

    expect(result.current.pendingReassign).not.toBeNull()
    expect(result.current.pendingReassign?.targetNode.id).toBe('n4')
  })

  it('area tree: sets pendingReassign when dragged node is near a team node', () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('area', onSuccess))

    act(() => {
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, teamNode])
    })

    expect(result.current.pendingReassign).not.toBeNull()
    expect(result.current.pendingReassign?.targetNode.id).toBe('n5')
  })
})

describe('cancelReassign', () => {
  it('clears pendingReassign after cancel', () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('org', onSuccess))

    act(() => {
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, memberNode2])
    })
    expect(result.current.pendingReassign).not.toBeNull()

    act(() => {
      result.current.cancelReassign()
    })
    expect(result.current.pendingReassign).toBeNull()
  })
})

describe('confirmReassign', () => {
  it('org type: calls PUT supervisor endpoint and invokes onSuccess', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('org', onSuccess))

    act(() => {
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, memberNode2])
    })
    expect(result.current.pendingReassign).not.toBeNull()

    await act(async () => {
      await result.current.confirmReassign()
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(result.current.pendingReassign).toBeNull()
  })

  it('program type: calls DELETE old assignment then POST new assignment and invokes onSuccess', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('program', onSuccess))

    // Set edges so the hook can find the old program assignment
    act(() => {
      result.current.setEdges([{ id: 'e1', source: 'program-1', target: 'n1' }])
    })

    act(() => {
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, programNode])
    })
    expect(result.current.pendingReassign).not.toBeNull()

    await act(async () => {
      await result.current.confirmReassign()
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(result.current.pendingReassign).toBeNull()
  })

  it('area type: calls PUT member endpoint with team_id and invokes onSuccess', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('area', onSuccess))

    act(() => {
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, teamNode])
    })
    expect(result.current.pendingReassign).not.toBeNull()

    await act(async () => {
      await result.current.confirmReassign()
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(result.current.pendingReassign).toBeNull()
  })

  it('does nothing when pendingReassign is null', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('org', onSuccess))

    expect(result.current.pendingReassign).toBeNull()

    await act(async () => {
      await result.current.confirmReassign()
    })

    expect(onSuccess).not.toHaveBeenCalled()
  })

  it('clears pendingReassign after successful confirm', async () => {
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('org', onSuccess))

    act(() => {
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, memberNode2])
    })

    await act(async () => {
      await result.current.confirmReassign()
    })

    expect(result.current.pendingReassign).toBeNull()
  })

  it('shows toast on API error and clears pendingReassign (finally block)', async () => {
    const { toast } = await import('sonner')
    const onSuccess = vi.fn()
    const { result } = renderHook(() => useDragReassign('org', onSuccess))

    // Override handler to return 500
    server.use(
      http.put('http://localhost:8000/api/org/members/:uuid/supervisor', () =>
        HttpResponse.json({ detail: 'Server error' }, { status: 500 }),
      ),
    )

    act(() => {
      result.current.handleNodeDragStop(mockMouseEvent, memberNode1, [memberNode1, memberNode2])
    })
    expect(result.current.pendingReassign).not.toBeNull()

    await act(async () => {
      await result.current.confirmReassign()
    })

    expect(toast.error).toHaveBeenCalled()
    // pendingReassign is cleared in the finally block regardless of error
    expect(result.current.pendingReassign).toBeNull()
    expect(onSuccess).not.toHaveBeenCalled()
  })
})
