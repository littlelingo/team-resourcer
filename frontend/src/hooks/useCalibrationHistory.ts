import { useQuery } from '@tanstack/react-query'
import { fetchMemberCalibrations } from '@/api/calibrationApi'
import { calibrationKeys } from '@/hooks/useCalibrationCycles'

export function useCalibrationHistory(memberUuid: string) {
  return useQuery({
    queryKey: calibrationKeys.byMember(memberUuid),
    queryFn: () => fetchMemberCalibrations(memberUuid),
    enabled: Boolean(memberUuid),
  })
}
