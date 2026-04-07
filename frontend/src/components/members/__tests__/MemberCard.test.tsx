import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MemberCard from '@/components/members/MemberCard'

const baseMember = {
  uuid: 'uuid-1',
  employee_id: 'E001',
  first_name: 'Alice',
  last_name: 'Example',
  title: 'Engineer' as string | null,
  city: 'New York' as string | null,
  state: null as string | null,
  image_path: null,
  email: 'alice@example.com',
  slack_handle: null,
  functional_area_id: 1,
  team_id: 1,
  supervisor_name: null as string | null,
  functional_manager_name: null as string | null,
  functional_area: { id: 1, name: 'Engineering', description: null },
  program_assignments: [{ program: { id: 1, name: 'Alpha' }, role: 'Lead' }],
}

const defaultProps = {
  member: baseMember,
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onClick: vi.fn(),
}

describe('MemberCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders member name', () => {
    render(<MemberCard {...defaultProps} />)
    expect(screen.getByText('Alice Example')).toBeInTheDocument()
  })

  it('renders member title', () => {
    render(<MemberCard {...defaultProps} />)
    expect(screen.getByText('Engineer')).toBeInTheDocument()
  })

  it('renders initials as avatar fallback', () => {
    render(<MemberCard {...defaultProps} />)
    expect(screen.getByText('AE')).toBeInTheDocument()
  })

  it('renders functional area badge', () => {
    render(<MemberCard {...defaultProps} />)
    expect(screen.getByText('Engineering')).toBeInTheDocument()
  })

  it('renders program assignment badge', () => {
    render(<MemberCard {...defaultProps} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('renders location', () => {
    render(<MemberCard {...defaultProps} />)
    expect(screen.getByText('New York')).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(<MemberCard {...defaultProps} onClick={onClick} />)
    // Click the card container (the outermost div)
    const card = screen.getByText('Alice Example').closest('.rounded-lg')!
    await user.click(card)
    expect(onClick).toHaveBeenCalledWith(baseMember)
  })

  it('does not render title when member has no title', () => {
    const member = { ...baseMember, title: null }
    render(<MemberCard {...defaultProps} member={member} />)
    expect(screen.queryByText('Engineer')).toBeNull()
  })

  it('does not render location when member has no location', () => {
    const member = { ...baseMember, city: null, state: null }
    render(<MemberCard {...defaultProps} member={member} />)
    expect(screen.queryByText('New York')).toBeNull()
  })

  it('renders functional manager name when present', () => {
    const member = { ...baseMember, functional_manager_name: 'Bob Smith' }
    render(<MemberCard {...defaultProps} member={member} />)
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
  })

  it('does not render functional manager line when functional_manager_name is null', () => {
    render(<MemberCard {...defaultProps} />)
    expect(screen.queryByText('FM:')).toBeNull()
  })

  it('renders employee ID with hash icon', () => {
    render(<MemberCard {...defaultProps} />)
    expect(screen.getByText('E001')).toBeInTheDocument()
  })

  it('dropdown menu shows Edit and Delete options after opening', async () => {
    const user = userEvent.setup()
    render(<MemberCard {...defaultProps} />)
    const trigger = screen.getByRole('button', { name: 'Member actions' })
    await user.click(trigger)
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('shows first 2 program badges and +N more chip when member has more than 2 programs', () => {
    const member = {
      ...baseMember,
      program_assignments: [
        { member_uuid: 'uuid-1', program_id: 1, program: { id: 1, name: 'Alpha' }, role: null },
        { member_uuid: 'uuid-1', program_id: 2, program: { id: 2, name: 'Beta' }, role: null },
        { member_uuid: 'uuid-1', program_id: 3, program: { id: 3, name: 'Gamma' }, role: null },
      ],
    }
    render(<MemberCard {...defaultProps} member={member} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Gamma')).toBeNull()
    expect(screen.getByText('+1 more')).toBeInTheDocument()
    expect(screen.getByTitle('Gamma')).toBeInTheDocument()
  })

  it('does not show +N more chip when member has 2 or fewer programs', () => {
    const member = {
      ...baseMember,
      program_assignments: [
        { member_uuid: 'uuid-1', program_id: 1, program: { id: 1, name: 'Alpha' }, role: null },
        { member_uuid: 'uuid-1', program_id: 2, program: { id: 2, name: 'Beta' }, role: null },
      ],
    }
    render(<MemberCard {...defaultProps} member={member} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText(/\+\d+ more/)).toBeNull()
  })
})
