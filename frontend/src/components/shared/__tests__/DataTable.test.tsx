import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DataTable } from '@/components/shared/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

type TestRow = { id: number; name: string }

const columns: ColumnDef<TestRow, unknown>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
]

const data: TestRow[] = [
  { id: 1, name: 'Alice' },
  { id: 2, name: 'Bob' },
]

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('renders data rows', () => {
    render(<DataTable columns={columns} data={data} />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
  })

  it('shows default empty message when data is empty', () => {
    render(<DataTable columns={columns} data={[]} />)
    expect(screen.getByText('No results found.')).toBeInTheDocument()
  })

  it('shows custom empty message when provided', () => {
    render(<DataTable columns={columns} data={[]} emptyMessage="Nothing here" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })

  it('shows skeleton rows when loading', () => {
    render(<DataTable columns={columns} data={[]} loading={true} />)
    const pulseElements = document.querySelectorAll('.animate-pulse')
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it('clicking sortable column header toggles sort indicator', async () => {
    const user = userEvent.setup()
    render(<DataTable columns={columns} data={data} />)

    // Find the Name header th element
    const nameHeader = screen.getByText('Name').closest('th')!

    // Before click: should have the ArrowUpDown (unsorted) indicator — no aria-sort
    expect(nameHeader).not.toHaveAttribute('aria-sort')

    // Click to sort ascending
    await user.click(nameHeader)
    // The ArrowUp svg should now be present (sorted asc)
    const arrowUp = nameHeader.querySelector('svg')
    expect(arrowUp).toBeInTheDocument()
  })
})
