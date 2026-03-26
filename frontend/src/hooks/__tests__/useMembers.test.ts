import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '@/test/msw/server'
import { http, HttpResponse } from 'msw'
import {
  useMembers,
  useMember,
  useCreateMember,
  useUpdateMember,
  useDeleteMember,
} from '@/hooks/useMembers'

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

describe('useMembers', () => {
  it('fetches list on mount', async () => {
    const { result } = renderHook(() => useMembers(), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ first_name: 'Alice', last_name: 'Example' }),
      ]),
    )
  })

  it('passes query params in URL', async () => {
    let capturedUrl: URL | null = null
    server.use(
      http.get('http://localhost:8000/api/members/', ({ request }) => {
        capturedUrl = new URL(request.url)
        return HttpResponse.json([])
      }),
    )
    const { result } = renderHook(() => useMembers({ title: 'Engineer' }), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(capturedUrl).not.toBeNull()
    expect(capturedUrl!.searchParams.get('title')).toBe('Engineer')
  })
})

describe('useMember', () => {
  it('fetches detail by uuid', async () => {
    const { result } = renderHook(() => useMember('uuid-1'), { wrapper: createWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.uuid).toBe('uuid-1')
  })

  it('is disabled when uuid is empty string', async () => {
    const { result } = renderHook(() => useMember(''), { wrapper: createWrapper() })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCreateMember', () => {
  it('POSTs successfully', async () => {
    const { result } = renderHook(() => useCreateMember(), { wrapper: createWrapper() })
    result.current.mutate({ first_name: 'Bob', last_name: 'New', employee_id: 'E002', email: 'bob@example.com' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useUpdateMember', () => {
  it('PUTs successfully', async () => {
    const { result } = renderHook(() => useUpdateMember(), { wrapper: createWrapper() })
    result.current.mutate({ uuid: 'uuid-1', data: { first_name: 'Alice', last_name: 'Updated' } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useDeleteMember', () => {
  it('sends DELETE successfully', async () => {
    const { result } = renderHook(() => useDeleteMember(), { wrapper: createWrapper() })
    result.current.mutate('uuid-1')
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
