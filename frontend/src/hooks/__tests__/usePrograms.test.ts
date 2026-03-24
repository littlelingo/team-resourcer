import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '@/test/msw/server'
import {
  usePrograms,
  useProgram,
  useProgramMembers,
  useCreateProgram,
  useUpdateProgram,
  useDeleteProgram,
} from '@/hooks/usePrograms'

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

describe('usePrograms', () => {
  it('fetches list', async () => {
    const { result } = renderHook(() => usePrograms(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0].name).toBe('Alpha Program')
  })
})

describe('useProgram', () => {
  it('fetches detail by id', async () => {
    const { result } = renderHook(() => useProgram(1), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe(1)
  })

  it('is disabled when id is 0', async () => {
    const { result } = renderHook(() => useProgram(0), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useProgramMembers', () => {
  it('is disabled when id is 0', async () => {
    const { result } = renderHook(() => useProgramMembers(0), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches members for a valid id', async () => {
    const { result } = renderHook(() => useProgramMembers(1), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(Array.isArray(result.current.data)).toBe(true)
  })
})

describe('useCreateProgram', () => {
  it('POSTs successfully', async () => {
    const { result } = renderHook(() => useCreateProgram(), { wrapper: createWrapper() })
    result.current.mutate({ name: 'Beta Program' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useUpdateProgram', () => {
  it('PUTs successfully', async () => {
    const { result } = renderHook(() => useUpdateProgram(), { wrapper: createWrapper() })
    result.current.mutate({ id: 1, data: { name: 'Alpha Updated' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useDeleteProgram', () => {
  it('DELETEs successfully', async () => {
    const { result } = renderHook(() => useDeleteProgram(), { wrapper: createWrapper() })
    result.current.mutate(1)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
