import { useQuery } from '@tanstack/react-query'
import { fetchMovement } from '@/api/calibrationApi'
import { calibrationKeys } from '@/hooks/useCalibrationCycles'

export function useCalibrationMovement(fromCycleId: number, toCycleId: number) {
  return useQuery({
    queryKey: calibrationKeys.movement(fromCycleId, toCycleId),
    queryFn: () => fetchMovement(fromCycleId, toCycleId),
    enabled: fromCycleId > 0 && toCycleId > 0 && fromCycleId !== toCycleId,
  })
}
