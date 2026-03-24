import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '@/test/msw/server'
import { useOrgTree, useProgramTree, useAreaTree } from '@/hooks/useTrees'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useOrgTree', () => {
  it('fetches /api/org/tree with nodes and edges', async () => {
    const { result } = renderHook(() => useOrgTree(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveProperty('nodes')
    expect(result.current.data).toHaveProperty('edges')
  })
})

describe('useProgramTree', () => {
  it('fetches for a valid id', async () => {
    const { result } = renderHook(() => useProgramTree(1), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(Array.isArray(result.current.data?.nodes)).toBe(true)
  })

  it('is disabled when id is 0', async () => {
    const { result } = renderHook(() => useProgramTree(0), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('is disabled when id is -1', async () => {
    const { result } = renderHook(() => useProgramTree(-1), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useAreaTree', () => {
  it('fetches for a valid id', async () => {
    const { result } = renderHook(() => useAreaTree(1), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(Array.isArray(result.current.data?.nodes)).toBe(true)
  })

  it('is disabled when id is 0', async () => {
    const { result } = renderHook(() => useAreaTree(0), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})
