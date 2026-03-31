import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api-client"
import { memberKeys } from "@/hooks/useMembers"
import type { Team, TeamFormInput, TeamListItem, TeamMemberList } from "@/types"

export const teamKeys = {
  all: ["teams"] as const,
  listAll: ["teams", "listAll"] as const,
  list: (areaId?: number) => ["teams", "list", areaId] as const,
  detail: (areaId: number, id: number) => ["teams", "detail", areaId, id] as const,
  members: (teamId: number) => ["teams", "members", teamId] as const,
}

/**
 * Fetch teams. If areaId is provided fetches /api/areas/{areaId}/teams/,
 * otherwise fetches all areas and their teams in parallel (not yet supported
 * by backend so we only support scoped-by-area queries in this hook).
 */
export function useTeams(areaId?: number) {
  return useQuery({
    queryKey: teamKeys.list(areaId),
    queryFn: () => {
      if (!areaId) return Promise.resolve([] as Team[])
      return apiFetch<Team[]>(`/api/areas/${areaId}/teams/`)
    },
    enabled: areaId !== undefined ? Boolean(areaId) : true,
  })
}

/** Fetch all teams across all functional areas. */
export function useAllTeams() {
  return useQuery({
    queryKey: teamKeys.listAll,
    queryFn: () => apiFetch<TeamListItem[]>("/api/teams/"),
  })
}

export function useCreateTeam(areaId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TeamFormInput) =>
      apiFetch<Team>(`/api/areas/${areaId}/teams/`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teamKeys.all })
    },
  })
}

export function useUpdateTeam(areaId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TeamFormInput> }) =>
      apiFetch<Team>(`/api/areas/${areaId}/teams/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { id }) => {
      void qc.invalidateQueries({ queryKey: teamKeys.all })
      void qc.invalidateQueries({ queryKey: teamKeys.detail(areaId, id) })
    },
  })
}

export function useDeleteTeam(areaId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<void>(`/api/areas/${areaId}/teams/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teamKeys.all })
    },
  })
}

export function useTeamMembers(teamId: number) {
  return useQuery({
    queryKey: teamKeys.members(teamId),
    queryFn: () => apiFetch<TeamMemberList[]>(`/api/members/?team_id=${teamId}`),
    enabled: Boolean(teamId),
  })
}

export function useAddTeamMember(areaId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, memberUuid }: { teamId: number; memberUuid: string }) =>
      apiFetch(`/api/areas/${areaId}/teams/${teamId}/members`, {
        method: "POST",
        body: JSON.stringify({ member_uuid: memberUuid }),
      }),
    onSuccess: (_result, { teamId }) => {
      void qc.invalidateQueries({ queryKey: teamKeys.members(teamId) })
      void qc.invalidateQueries({ queryKey: memberKeys.all })
    },
  })
}

export function useRemoveTeamMember(areaId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ teamId, memberUuid }: { teamId: number; memberUuid: string }) =>
      apiFetch<void>(`/api/areas/${areaId}/teams/${teamId}/members/${memberUuid}`, {
        method: "DELETE",
      }),
    onSuccess: (_result, { teamId }) => {
      void qc.invalidateQueries({ queryKey: teamKeys.members(teamId) })
      void qc.invalidateQueries({ queryKey: memberKeys.all })
    },
  })
}
