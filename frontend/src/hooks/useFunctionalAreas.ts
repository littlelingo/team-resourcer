import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { FunctionalArea, FunctionalAreaFormInput, TeamMemberList } from "@/types"

export const areaKeys = {
  all: ["areas"] as const,
  list: () => ["areas", "list"] as const,
  detail: (id: number) => ["areas", "detail", id] as const,
  members: (id: number) => ["areas", "members", id] as const,
}

export function useFunctionalAreas() {
  return useQuery({
    queryKey: areaKeys.list(),
    queryFn: () => apiFetch<FunctionalArea[]>("/api/areas/"),
  })
}

export function useCreateFunctionalArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: FunctionalAreaFormInput) =>
      apiFetch<FunctionalArea>("/api/areas/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: areaKeys.all })
    },
  })
}

export function useUpdateFunctionalArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<FunctionalAreaFormInput> }) =>
      apiFetch<FunctionalArea>(`/api/areas/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { id }) => {
      void qc.invalidateQueries({ queryKey: areaKeys.all })
      void qc.invalidateQueries({ queryKey: areaKeys.detail(id) })
    },
  })
}

export function useDeleteFunctionalArea() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/api/areas/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: areaKeys.all })
    },
  })
}

export function useAreaMembers(areaId: number) {
  return useQuery({
    queryKey: areaKeys.members(areaId),
    queryFn: () => apiFetch<TeamMemberList[]>(`/api/members/?area_id=${areaId}`),
    enabled: Boolean(areaId),
  })
}
