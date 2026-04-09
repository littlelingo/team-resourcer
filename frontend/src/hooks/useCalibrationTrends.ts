import { useQuery } from '@tanstack/react-query'
import { fetchTrends } from '@/api/calibrationApi'
import { calibrationKeys } from '@/hooks/useCalibrationCycles'

export function useCalibrationTrends(cycles = 8) {
  return useQuery({
    queryKey: calibrationKeys.trends(cycles),
    queryFn: () => fetchTrends(cycles),
  })
}
