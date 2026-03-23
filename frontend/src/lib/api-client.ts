const BASE_URL = import.meta.env.VITE_API_BASE_URL as string

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const isFormData = options?.body instanceof FormData

  const headers: HeadersInit = isFormData
    ? {}
    : { "Content-Type": "application/json", ...(options?.headers ?? {}) }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let message = response.statusText
    try {
      const json = (await response.json()) as { detail?: string }
      if (json.detail) message = String(json.detail)
    } catch {
      // ignore parse errors
    }
    throw new Error(message)
  }

  // 204 No Content — return undefined cast to T
  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function getImageUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (path.startsWith("/")) return `${BASE_URL}${path}`
  return path
}
