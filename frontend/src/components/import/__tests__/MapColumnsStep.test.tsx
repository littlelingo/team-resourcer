import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MapColumnsStep, { CALIBRATION_TARGET_FIELDS } from '@/components/import/MapColumnsStep'

vi.mock('@/api/importApi', () => ({
  previewMapping: vi.fn(),
}))

import { previewMapping } from '@/api/importApi'

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const defaultProps = {
  sessionId: 'session-123',
  headers: ['Employee ID', 'First Name', 'Last Name'],
  initialColumnMap: {} as Record<string, string | null>,
  onPreview: vi.fn(),
}

describe('MapColumnsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all source column headers', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    const spans = screen.getAllByText('Employee ID')
    expect(spans.some((el) => el.tagName === 'SPAN')).toBe(true)
    const firstNameSpans = screen.getAllByText('First Name')
    expect(firstNameSpans.some((el) => el.tagName === 'SPAN')).toBe(true)
    const lastNameSpans = screen.getAllByText('Last Name')
    expect(lastNameSpans.some((el) => el.tagName === 'SPAN')).toBe(true)
  })

  it('renders "Map Columns" heading', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    expect(screen.getByText('Map Columns')).toBeInTheDocument()
  })

  it('auto-suggests employee_id for "Employee ID" header', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    const selects = screen.getAllByRole('combobox')
    expect((selects[0] as HTMLSelectElement).value).toBe('employee_id')
  })

  it('auto-suggests first_name for "First Name" header', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    const selects = screen.getAllByRole('combobox')
    expect((selects[1] as HTMLSelectElement).value).toBe('first_name')
  })

  it('renders Skip option in each select', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    const skipOptions = screen.getAllByText('Skip this column')
    expect(skipOptions.length).toBeGreaterThanOrEqual(3)
  })

  it('shows required fields warning when required fields not mapped', () => {
    renderWithQuery(
      <MapColumnsStep
        {...defaultProps}
        headers={['Column A', 'Column B']}
        initialColumnMap={{}}
      />
    )
    expect(screen.getByText(/Map at least/)).toBeInTheDocument()
  })

  it('Preview button is disabled when required fields not mapped', () => {
    renderWithQuery(
      <MapColumnsStep
        {...defaultProps}
        headers={['Column A']}
        initialColumnMap={{}}
      />
    )
    expect(screen.getByRole('button', { name: /preview/i })).toBeDisabled()
  })

  it('Preview button is enabled when required fields are mapped', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    expect(screen.getByRole('button', { name: /preview/i })).not.toBeDisabled()
  })

  it('uses initialColumnMap when provided', () => {
    renderWithQuery(
      <MapColumnsStep
        {...defaultProps}
        headers={['Col A']}
        initialColumnMap={{ 'Col A': 'title' }}
      />
    )
    const selects = screen.getAllByRole('combobox')
    expect((selects[0] as HTMLSelectElement).value).toBe('title')
  })

  it('changing a select updates the mapping', async () => {
    const user = userEvent.setup()
    renderWithQuery(
      <MapColumnsStep
        {...defaultProps}
        headers={['Column X']}
        initialColumnMap={{ 'Column X': null }}
      />
    )
    const select = screen.getAllByRole('combobox')[0] as HTMLSelectElement
    await user.selectOptions(select, 'email')
    expect(select.value).toBe('email')
  })

  it('calls previewMapping and onPreview on preview click with no constant mappings', async () => {
    const onPreview = vi.fn()
    const user = userEvent.setup()
    const mockResult = { rows: [], error_count: 0, warning_count: 0 }
    vi.mocked(previewMapping).mockResolvedValue(mockResult)

    renderWithQuery(<MapColumnsStep {...defaultProps} onPreview={onPreview} />)

    const previewBtn = screen.getByRole('button', { name: /preview/i })
    await user.click(previewBtn)

    await vi.waitFor(() => {
      expect(onPreview).toHaveBeenCalledWith(
        { 'Employee ID': 'employee_id', 'First Name': 'first_name', 'Last Name': 'last_name' },
        mockResult,
        [] // no constant mappings for member import
      )
    })
  })
})

// ─── Calibration target fields ─────────────────────────────────────────────────

describe('CALIBRATION_TARGET_FIELDS', () => {
  it('includes cycle_label as constant source', () => {
    const cycleLabelField = CALIBRATION_TARGET_FIELDS.find((f) => f.value === 'cycle_label')
    expect(cycleLabelField).toBeDefined()
    expect(cycleLabelField?.source).toBe('constant')
    expect(cycleLabelField?.required).toBe(true)
  })

  it('includes effective_date as column-or-constant', () => {
    const effDateField = CALIBRATION_TARGET_FIELDS.find((f) => f.value === 'effective_date')
    expect(effDateField).toBeDefined()
    expect(effDateField?.source).toBe('column-or-constant')
    expect(effDateField?.required).toBe(true)
  })

  it('includes box as required column', () => {
    const boxField = CALIBRATION_TARGET_FIELDS.find((f) => f.value === 'box')
    expect(boxField).toBeDefined()
    expect(boxField?.source).toBe('column')
    expect(boxField?.required).toBe(true)
  })

  it('includes verbatim flag fields as optional columns', () => {
    const verbatimFields = [
      'high_growth_or_key_talent',
      'ready_for_promotion',
      'can_mentor_juniors',
      'next_move_recommendation',
      'rationale',
      'reviewers',
    ]
    for (const fieldValue of verbatimFields) {
      const field = CALIBRATION_TARGET_FIELDS.find((f) => f.value === fieldValue)
      expect(field, `Missing field: ${fieldValue}`).toBeDefined()
      expect(field?.required).toBeFalsy()
    }
  })
})

describe('MapColumnsStep calibration constant-value support', () => {
  const calibrationProps = {
    sessionId: 'session-cal',
    headers: ['First Name', 'Last Name', '9-Box Matrix'],
    initialColumnMap: {} as Record<string, string | null>,
    onPreview: vi.fn(),
    targetFields: CALIBRATION_TARGET_FIELDS,
    requiredFields: ['first_name', 'last_name', 'cycle_label', 'box'],
    entityType: 'calibration' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Constant Values section for calibration', () => {
    renderWithQuery(<MapColumnsStep {...calibrationProps} />)
    expect(screen.getByText('Constant Values')).toBeInTheDocument()
  })

  it('renders cycle_label constant input with placeholder', () => {
    renderWithQuery(<MapColumnsStep {...calibrationProps} />)
    const inputs = screen.getAllByPlaceholderText(/e\.g\. 2026 Q1/i)
    expect(inputs.length).toBeGreaterThanOrEqual(1)
  })

  it('Preview button disabled when cycle_label constant not provided', () => {
    renderWithQuery(<MapColumnsStep {...calibrationProps} />)
    // map required column fields
    const selects = screen.getAllByRole('combobox')
    // The cycle_label constant input is empty → required not satisfied
    const previewBtn = screen.getByRole('button', { name: /preview/i })
    expect(previewBtn).toBeDisabled()
  })

  it('Preview button enabled when all required fields are satisfied', async () => {
    const user = userEvent.setup()
    renderWithQuery(<MapColumnsStep {...calibrationProps} />)

    // Fill in the cycle_label constant
    const cycleLabelInput = screen.getByPlaceholderText(/e\.g\. 2026 Q1/i)
    await user.type(cycleLabelInput, '2026 Q1')

    // Map columns to required fields
    const selects = screen.getAllByRole('combobox')
    await user.selectOptions(selects[0], 'first_name')
    await user.selectOptions(selects[1], 'last_name')
    await user.selectOptions(selects[2], 'box')

    // effective_date is also required but has column-or-constant — fill constant
    const effectiveDateInputs = screen.queryAllByPlaceholderText(/e\.g\. 2026-03-31/i)
    if (effectiveDateInputs.length > 0) {
      await user.type(effectiveDateInputs[0], '2026-03-31')
    }

    const previewBtn = screen.getByRole('button', { name: /preview/i })
    expect(previewBtn).not.toBeDisabled()
  })
})
