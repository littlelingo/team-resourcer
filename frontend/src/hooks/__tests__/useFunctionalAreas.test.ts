import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { server } from '@/test/msw/server'
import {
  useFunctionalAreas,
  useCreateFunctionalArea,
  useUpdateFunctionalArea,
  useDeleteFunctionalArea,
} from '@/hooks/useFunctionalAreas'

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

describe('useFunctionalAreas', () => {
  it('fetches list on mount', async () => {
    const { result } = renderHook(() => useFunctionalAreas(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data![0].name).toBe('Engineering')
  })

  it('useCreateFunctionalArea POSTs successfully', async () => {
    const { result } = renderHook(() => useCreateFunctionalArea(), { wrapper: createWrapper() })
    result.current.mutate({ name: 'Design' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useUpdateFunctionalArea PUTs successfully', async () => {
    const { result } = renderHook(() => useUpdateFunctionalArea(), { wrapper: createWrapper() })
    result.current.mutate({ id: 1, data: { name: 'Engineering Updated' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('useDeleteFunctionalArea sends DELETE', async () => {
    const { result } = renderHook(() => useDeleteFunctionalArea(), { wrapper: createWrapper() })
    result.current.mutate(1)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
