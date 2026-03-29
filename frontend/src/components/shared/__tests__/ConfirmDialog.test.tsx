import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  title: 'Delete Item',
  description: 'Are you sure you want to delete this?',
  onConfirm: vi.fn(),
}

describe('ConfirmDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title and description when open', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Delete Item')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to delete this?')).toBeInTheDocument()
  })

  it('does not render content when closed', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />)
    expect(screen.queryByText('Delete Item')).toBeNull()
    expect(screen.queryByText('Are you sure you want to delete this?')).toBeNull()
  })

  it('calls onConfirm when Confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: /confirm/i }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('calls onOpenChange when Cancel is clicked', async () => {
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalled()
  })

  it('disables both buttons when loading is true', () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('shows spinner when loading', () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />)
    // Loader2 renders an SVG with animate-spin class
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })
})
