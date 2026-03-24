import { queryClient } from '@/lib/query-client'

describe('queryClient', () => {
  it('is a QueryClient instance with default staleTime', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.staleTime).toBe(60_000)
  })

  it('has retry set to 1', () => {
    const defaults = queryClient.getDefaultOptions()
    expect(defaults.queries?.retry).toBe(1)
  })
})
