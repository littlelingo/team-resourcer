import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api-client'
import type { TreeData } from '@/types/trees'

export function useOrgTree() {
  return useQuery({
    queryKey: ['org-tree'],
    queryFn: () => apiFetch<TreeData>('/api/org/tree'),
  })
}

export function useProgramTree(id: number) {
  return useQuery({
    queryKey: ['program-tree', id],
    queryFn: () => apiFetch<TreeData>(`/api/programs/${id}/tree`),
    enabled: id > 0,
  })
}

export function useAreaTree(id: number) {
  return useQuery({
    queryKey: ['area-tree', id],
    queryFn: () => apiFetch<TreeData>(`/api/areas/${id}/tree`),
    enabled: id > 0,
  })
}
