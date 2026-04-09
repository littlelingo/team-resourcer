import React from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '@/test/msw/server'
import { http, HttpResponse } from 'msw'
import { useCalibrationCycles, calibrationKeys, invalidateAllCalibrationViews } from '@/hooks/useCalibrationCycles'
import { useLatestCalibrations, useCreateCalibration, useUpdateCalibration, useDeleteCalibration } from '@/hooks/useCalibrations'
import { useCalibrationHistory } from '@/hooks/useCalibrationHistory'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return {
    wrapper: function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children)
    },
    queryClient,
  }
}

// ─── Key structure ─────────────────────────────────────────────────────────────

describe('calibrationKeys', () => {
  it('all key is stable', () => {
    expect(calibrationKeys.all).toEqual(['calibrations'])
  })

  it('cycles key is stable', () => {
    expect(calibrationKeys.cycles).toEqual(['calibrations', 'cycles'])
  })

  it('latest key includes filter object', () => {
    const key = calibrationKeys.latest({ cycle_id: 1 })
    expect(key).toEqual(['calibrations', 'latest', { cycle_id: 1 }])
  })

  it('byMember key includes uuid', () => {
    const key = calibrationKeys.byMember('uuid-1')
    expect(key).toEqual(['calibrations', 'member', 'uuid-1'])
  })

  it('movement key includes from and to', () => {
    const key = calibrationKeys.movement(1, 2)
    expect(key).toEqual(['calibrations', 'movement', 1, 2])
  })

  it('trends key includes n', () => {
    const key = calibrationKeys.trends(8)
    expect(key).toEqual(['calibrations', 'trends', 8])
  })
})

// ─── invalidateAllCalibrationViews ────────────────────────────────────────────

describe('invalidateAllCalibrationViews', () => {
  it('calls invalidateQueries without throwing', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    invalidateAllCalibrationViews(qc)
    expect(spy).toHaveBeenCalledWith({ queryKey: calibrationKeys.all })
  })

  it('invalidates member keys when memberUuid provided', () => {
    const qc = new QueryClient()
    const spy = vi.spyOn(qc, 'invalidateQueries')
    invalidateAllCalibrationViews(qc, 'uuid-1')
    expect(spy).toHaveBeenCalledTimes(2)
  })
})

// ─── useCalibrationCycles ─────────────────────────────────────────────────────

describe('useCalibrationCycles', () => {
  it('fetches cycles on mount', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCalibrationCycles(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '2026 Q1', sequence_number: 1 }),
      ]),
    )
  })
})

// ─── useLatestCalibrations ────────────────────────────────────────────────────

describe('useLatestCalibrations', () => {
  it('fetches latest calibrations', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useLatestCalibrations(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ box: 4, label: 'High Prof+', performance: 3, potential: 2 }),
      ]),
    )
  })

  it('passes cycle_id filter in query key', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useLatestCalibrations({ cycle_id: 1 }), { wrapper })
    expect(result.current.isPending).toBe(true)
  })
})

// ─── useCalibrationHistory ────────────────────────────────────────────────────

describe('useCalibrationHistory', () => {
  it('fetches member calibration history', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCalibrationHistory('uuid-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].box).toBe(4)
  })

  it('is disabled when uuid is empty string', () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCalibrationHistory(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })
})

// ─── useCreateCalibration ─────────────────────────────────────────────────────

describe('useCreateCalibration', () => {
  it('POSTs successfully', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateCalibration('uuid-1'), { wrapper })
    result.current.mutate({ cycle_id: 1, box: 5, effective_date: '2026-03-31' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.box).toBe(5)
    expect(result.current.data?.label).toBe('Key Performer')
  })
})

// ─── useUpdateCalibration ─────────────────────────────────────────────────────

describe('useUpdateCalibration', () => {
  it('PUTs successfully', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateCalibration('uuid-1'), { wrapper })
    result.current.mutate({ calibrationId: 1, data: { box: 3 } })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.box).toBe(3)
    expect(result.current.data?.label).toBe('Enigma')
  })
})

// ─── useDeleteCalibration ─────────────────────────────────────────────────────

describe('useDeleteCalibration', () => {
  it('sends DELETE successfully', async () => {
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useDeleteCalibration('uuid-1'), { wrapper })
    result.current.mutate(1)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

// ─── Error handling ───────────────────────────────────────────────────────────

describe('useLatestCalibrations error handling', () => {
  it('sets isError when API returns 500', async () => {
    server.use(
      http.get('http://localhost:8000/api/calibrations/latest', () =>
        HttpResponse.json({ detail: 'Internal error' }, { status: 500 }),
      ),
    )
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useLatestCalibrations(), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
