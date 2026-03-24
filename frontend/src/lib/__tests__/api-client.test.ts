import { apiFetch, getImageUrl } from '@/lib/api-client'

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('apiFetch', () => {
  it('sets Content-Type: application/json for JSON bodies', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    await apiFetch('/test')

    const calledHeaders = mockFetch.mock.calls[0][1].headers
    expect(calledHeaders['Content-Type']).toBe('application/json')
  })

  it('omits Content-Type when body is FormData', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    await apiFetch('/test', { body: new FormData() })

    const calledHeaders = mockFetch.mock.calls[0][1].headers
    expect(calledHeaders['Content-Type']).toBeUndefined()
  })

  it('returns undefined for 204 responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    }))

    const result = await apiFetch('/test')

    expect(result).toBeUndefined()
  })

  it('throws with statusText on non-ok response with no JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => { throw new Error() },
    }))

    await expect(apiFetch('/test')).rejects.toThrow('Not Found')
  })

  it('throws with detail field from JSON error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ detail: 'Validation error' }),
    }))

    await expect(apiFetch('/test')).rejects.toThrow('Validation error')
  })

  it('calls fetch with BASE_URL prepended to path', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    await apiFetch('/some/path')

    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl.startsWith('http://localhost:8000')).toBe(true)
  })
})

describe('getImageUrl', () => {
  it('returns undefined for null', () => {
    expect(getImageUrl(null)).toBeUndefined()
  })

  it('returns undefined for undefined', () => {
    expect(getImageUrl(undefined)).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(getImageUrl('')).toBeUndefined()
  })

  it('prepends BASE_URL for relative path', () => {
    expect(getImageUrl('/media/abc.jpg')).toBe('http://localhost:8000/media/abc.jpg')
  })

  it('returns absolute URL unchanged', () => {
    expect(getImageUrl('https://cdn.example.com/img.jpg')).toBe('https://cdn.example.com/img.jpg')
  })
})
