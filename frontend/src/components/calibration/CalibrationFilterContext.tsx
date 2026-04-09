import { createContext, useContext, useState, type ReactNode } from 'react'

export interface CalibrationFilters {
  areaId: number | undefined
  teamId: number | undefined
  programId: number | undefined
  cycleId: number | undefined
}

interface CalibrationFilterContextValue extends CalibrationFilters {
  setFilter: (key: keyof CalibrationFilters, value: number | undefined) => void
  clear: () => void
}

const CalibrationFilterContext = createContext<CalibrationFilterContextValue | null>(null)

const EMPTY_FILTERS: CalibrationFilters = {
  areaId: undefined,
  teamId: undefined,
  programId: undefined,
  cycleId: undefined,
}

export function CalibrationFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<CalibrationFilters>(EMPTY_FILTERS)

  function setFilter(key: keyof CalibrationFilters, value: number | undefined) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function clear() {
    setFilters(EMPTY_FILTERS)
  }

  return (
    <CalibrationFilterContext.Provider value={{ ...filters, setFilter, clear }}>
      {children}
    </CalibrationFilterContext.Provider>
  )
}

export function useCalibrationFilters() {
  const ctx = useContext(CalibrationFilterContext)
  if (!ctx) {
    throw new Error('useCalibrationFilters must be used within CalibrationFilterProvider')
  }
  return ctx
}
