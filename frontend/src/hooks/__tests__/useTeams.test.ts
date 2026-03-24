import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { server } from '@/test/msw/server'
import {
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
} from '@/hooks/useTeams'

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

describe('useTeams', () => {
  it('fetches teams for an area', async () => {
    const { result } = renderHook(() => useTeams(1), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].name).toBe('Team Alpha')
  })

  it('returns empty array when no areaId', async () => {
    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })

  it('is disabled when areaId is 0', () => {
    const { result } = renderHook(() => useTeams(0), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('useCreateTeam POSTs successfully', async () => {
    const { result } = renderHook(() => useCreateTeam(1), { wrapper: createWrapper() })
    result.current.mutate({ name: 'Team Beta' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useUpdateTeam PUTs successfully', async () => {
    const { result } = renderHook(() => useUpdateTeam(1), { wrapper: createWrapper() })
    result.current.mutate({ id: 1, data: { name: 'Team Alpha Updated' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useDeleteTeam sends DELETE', async () => {
    const { result } = renderHook(() => useDeleteTeam(1), { wrapper: createWrapper() })
    result.current.mutate(1)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
