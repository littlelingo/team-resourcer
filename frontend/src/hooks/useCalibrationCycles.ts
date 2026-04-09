import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCycles } from '@/api/calibrationApi'
import { memberKeys } from '@/hooks/useMembers'

// ─── Query keys ───────────────────────────────────────────────────────────────

export const calibrationKeys = {
  all: ['calibrations'] as const,
  cycles: ['calibrations', 'cycles'] as const,
  latest: (filters?: Record<string, number | undefined>) =>
    ['calibrations', 'latest', filters ?? {}] as const,
  movement: (from: number, to: number) => ['calibrations', 'movement', from, to] as const,
  trends: (n: number) => ['calibrations', 'trends', n] as const,
  byMember: (uuid: string) => ['calibrations', 'member', uuid] as const,
}

/**
 * Invalidate every calibration-related query plus the member detail cache.
 * Call this in every mutation onSuccess to avoid stale data.
 */
export function invalidateAllCalibrationViews(
  qc: ReturnType<typeof useQueryClient>,
  memberUuid?: string,
) {
  void qc.invalidateQueries({ queryKey: calibrationKeys.all })
  if (memberUuid) {
    void qc.invalidateQueries({ queryKey: memberKeys.detail(memberUuid) })
  } else {
    // Invalidate all member details (cover cases where caller doesn't know uuid)
    void qc.invalidateQueries({ queryKey: memberKeys.all })
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCalibrationCycles() {
  return useQuery({
    queryKey: calibrationKeys.cycles,
    queryFn: fetchCycles,
  })
}
