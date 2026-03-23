import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import type { TeamMember, TeamMemberList, MemberFormInput } from "@/types"

export const memberKeys = {
  all: ["members"] as const,
  list: (params?: Record<string, string>) => ["members", "list", params] as const,
  detail: (uuid: string) => ["members", "detail", uuid] as const,
}

export function useMembers(params?: Record<string, string>) {
  const search = params ? "?" + new URLSearchParams(params).toString() : ""
  return useQuery({
    queryKey: memberKeys.list(params),
    queryFn: () => apiFetch<TeamMemberList[]>(`/api/members/${search}`),
  })
}

export function useMember(uuid: string) {
  return useQuery({
    queryKey: memberKeys.detail(uuid),
    queryFn: () => apiFetch<TeamMember>(`/api/members/${uuid}`),
    enabled: Boolean(uuid),
  })
}

export function useCreateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MemberFormInput) =>
      apiFetch<TeamMember>("/api/members/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: memberKeys.all })
    },
  })
}

export function useUpdateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ uuid, data }: { uuid: string; data: Partial<MemberFormInput> }) =>
      apiFetch<TeamMember>(`/api/members/${uuid}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { uuid }) => {
      void qc.invalidateQueries({ queryKey: memberKeys.all })
      void qc.invalidateQueries({ queryKey: memberKeys.detail(uuid) })
    },
  })
}

export function useDeleteMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (uuid: string) =>
      apiFetch<void>(`/api/members/${uuid}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: memberKeys.all })
    },
  })
}
