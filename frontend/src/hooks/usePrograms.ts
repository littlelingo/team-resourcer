import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { Program, TeamMemberList, ProgramFormInput } from "@/types"

export const programKeys = {
  all: ["programs"] as const,
  list: () => ["programs", "list"] as const,
  detail: (id: number) => ["programs", "detail", id] as const,
  members: (id: number) => ["programs", "members", id] as const,
}

export function usePrograms() {
  return useQuery({
    queryKey: programKeys.list(),
    queryFn: () => apiFetch<Program[]>("/api/programs/"),
  })
}

export function useProgram(id: number) {
  return useQuery({
    queryKey: programKeys.detail(id),
    queryFn: () => apiFetch<Program>(`/api/programs/${id}`),
    enabled: Boolean(id),
  })
}

export function useProgramMembers(id: number) {
  return useQuery({
    queryKey: programKeys.members(id),
    queryFn: () => apiFetch<TeamMemberList[]>(`/api/programs/${id}/members`),
    enabled: Boolean(id),
  })
}

export function useCreateProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProgramFormInput) =>
      apiFetch<Program>("/api/programs/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: programKeys.all })
    },
  })
}

export function useUpdateProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProgramFormInput> }) =>
      apiFetch<Program>(`/api/programs/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { id }) => {
      void qc.invalidateQueries({ queryKey: programKeys.all })
      void qc.invalidateQueries({ queryKey: programKeys.detail(id) })
    },
  })
}

export function useDeleteProgram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/api/programs/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: programKeys.all })
    },
  })
}
