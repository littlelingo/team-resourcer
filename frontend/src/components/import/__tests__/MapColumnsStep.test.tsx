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

  it('calls previewMapping and onPreview on preview click', async () => {
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
        mockResult
      )
    })
  })
})
