import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { Agency, AgencyFormInput } from "@/types"

export const agencyKeys = {
  all: ["agencies"] as const,
  list: () => ["agencies", "list"] as const,
  detail: (id: number) => ["agencies", "detail", id] as const,
}

export function useAgencies() {
  return useQuery({
    queryKey: agencyKeys.list(),
    queryFn: () => apiFetch<Agency[]>("/api/agencies/"),
  })
}

export function useCreateAgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AgencyFormInput) =>
      apiFetch<Agency>("/api/agencies/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: agencyKeys.all })
    },
  })
}

export function useUpdateAgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<AgencyFormInput> }) =>
      apiFetch<Agency>(`/api/agencies/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { id }) => {
      void qc.invalidateQueries({ queryKey: agencyKeys.all })
      void qc.invalidateQueries({ queryKey: agencyKeys.detail(id) })
    },
  })
}

export function useDeleteAgency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/api/agencies/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: agencyKeys.all })
    },
  })
}
