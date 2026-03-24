import { getInitials } from '@/lib/member-utils'

describe('getInitials', () => {
  it('single word returns first two chars uppercased', () => {
    expect(getInitials('alice')).toBe('AL')
  })

  it('single char returns that char uppercased', () => {
    expect(getInitials('a')).toBe('A')
  })

  it('two words returns first letter of each word', () => {
    expect(getInitials('Alice Example')).toBe('AE')
  })

  it('three words returns first and last initial', () => {
    expect(getInitials('Alice Marie Example')).toBe('AE')
  })

  it('extra whitespace is trimmed and collapsed', () => {
    expect(getInitials('  Alice   Example  ')).toBe('AE')
  })

  it('all caps input preserved', () => {
    expect(getInitials('ALICE EXAMPLE')).toBe('AE')
  })

  it('unicode names', () => {
    expect(getInitials('Ångström Björk')).toBe('ÅB')
  })
})
