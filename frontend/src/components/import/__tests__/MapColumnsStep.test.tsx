import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import MapColumnsStep from '@/components/import/MapColumnsStep'

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
  headers: ['Employee ID', 'Full Name'],
  initialColumnMap: {} as Record<string, string | null>,
  onPreview: vi.fn(),
}

describe('MapColumnsStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all source column headers', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    // Source headers render inside a <span class="font-mono ...">
    const spans = screen.getAllByText('Employee ID')
    expect(spans.some((el) => el.tagName === 'SPAN')).toBe(true)
    const nameSpans = screen.getAllByText('Full Name')
    expect(nameSpans.some((el) => el.tagName === 'SPAN')).toBe(true)
  })

  it('renders "Map Columns" heading', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    expect(screen.getByText('Map Columns')).toBeInTheDocument()
  })

  it('auto-suggests employee_id for "Employee ID" header', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    // The selects are ordered by headers array; first header is 'Employee ID'
    const selects = screen.getAllByRole('combobox')
    expect((selects[0] as HTMLSelectElement).value).toBe('employee_id')
  })

  it('auto-suggests name for "Full Name" header', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    const selects = screen.getAllByRole('combobox')
    expect((selects[1] as HTMLSelectElement).value).toBe('name')
  })

  it('renders Skip option in each select', () => {
    renderWithQuery(<MapColumnsStep {...defaultProps} />)
    const skipOptions = screen.getAllByText('Skip this column')
    // Each select has a Skip option; we have 2 headers
    expect(skipOptions.length).toBeGreaterThanOrEqual(2)
  })

  it('shows required fields warning when employee_id/name not mapped', () => {
    renderWithQuery(
      <MapColumnsStep
        {...defaultProps}
        headers={['Column A', 'Column B']}
        initialColumnMap={{}}
      />
    )
    // The warning text mentions both required fields
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
    // 'Employee ID' -> employee_id and 'Full Name' -> name are auto-mapped
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

  it('calls previewMapping and onPreview on preview click', async () => {
    const onPreview = vi.fn()
    const user = userEvent.setup()
    const mockResult = { rows: [], error_count: 0, warning_count: 0 }
    vi.mocked(previewMapping).mockResolvedValue(mockResult)

    renderWithQuery(<MapColumnsStep {...defaultProps} onPreview={onPreview} />)

    const previewBtn = screen.getByRole('button', { name: /preview/i })
    await user.click(previewBtn)

    // Wait for the mutation to resolve
    await vi.waitFor(() => {
      expect(onPreview).toHaveBeenCalledWith(
        { 'Employee ID': 'employee_id', 'Full Name': 'name' },
        mockResult
      )
    })
  })
})
