import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCalibration,
  deleteCalibration,
  fetchLatestCalibrations,
  updateCalibration,
} from '@/api/calibrationApi'
import type { CalibrationCreate, CalibrationUpdate } from '@/api/calibrationApi'
import { calibrationKeys, invalidateAllCalibrationViews } from '@/hooks/useCalibrationCycles'

interface LatestFilters {
  area_id?: number
  team_id?: number
  program_id?: number
  cycle_id?: number
  [key: string]: number | undefined
}

export function useLatestCalibrations(filters?: LatestFilters) {
  return useQuery({
    queryKey: calibrationKeys.latest(filters),
    queryFn: () => fetchLatestCalibrations(filters),
  })
}

export function useCreateCalibration(memberUuid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CalibrationCreate) => createCalibration(memberUuid, data),
    onSuccess: () => {
      invalidateAllCalibrationViews(qc, memberUuid)
    },
  })
}

export function useUpdateCalibration(memberUuid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ calibrationId, data }: { calibrationId: number; data: CalibrationUpdate }) =>
      updateCalibration(memberUuid, calibrationId, data),
    onSuccess: () => {
      invalidateAllCalibrationViews(qc, memberUuid)
    },
  })
}

export function useDeleteCalibration(memberUuid: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (calibrationId: number) => deleteCalibration(memberUuid, calibrationId),
    onSuccess: () => {
      invalidateAllCalibrationViews(qc, memberUuid)
    },
  })
}
