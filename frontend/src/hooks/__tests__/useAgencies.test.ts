import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { server } from '@/test/msw/server'
import {
  useAgencies,
  useCreateAgency,
  useUpdateAgency,
  useDeleteAgency,
} from '@/hooks/useAgencies'

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

describe('useAgencies', () => {
  it('fetches agencies', async () => {
    const { result } = renderHook(() => useAgencies(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].name).toBe('Acme Corp')
  })

  it('useCreateAgency POSTs successfully', async () => {
    const { result } = renderHook(() => useCreateAgency(), { wrapper: createWrapper() })
    result.current.mutate({ name: 'New Agency' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useUpdateAgency PUTs successfully', async () => {
    const { result } = renderHook(() => useUpdateAgency(), { wrapper: createWrapper() })
    result.current.mutate({ id: 1, data: { name: 'Acme Corp Updated' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useDeleteAgency sends DELETE', async () => {
    const { result } = renderHook(() => useDeleteAgency(), { wrapper: createWrapper() })
    result.current.mutate(1)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
