import { getInitials, getInitialsFromName } from '@/lib/member-utils'

describe('getInitials', () => {
  it('returns first char of each name', () => {
    expect(getInitials('Alice', 'Example')).toBe('AE')
  })

  it('returns first 2 chars when last name empty', () => {
    expect(getInitials('alice', '')).toBe('AL')
  })

  it('single char first name with empty last', () => {
    expect(getInitials('a', '')).toBe('A')
  })

  it('trims whitespace', () => {
    expect(getInitials('  Alice  ', '  Example  ')).toBe('AE')
  })

  it('returns ? when both empty', () => {
    expect(getInitials('', '')).toBe('?')
  })

  it('unicode names', () => {
    expect(getInitials('Ångström', 'Björk')).toBe('ÅB')
  })
})

describe('getInitialsFromName', () => {
  it('two words returns first letter of each', () => {
    expect(getInitialsFromName('Alice Example')).toBe('AE')
  })

  it('single word returns first two chars', () => {
    expect(getInitialsFromName('alice')).toBe('AL')
  })

  it('three words returns first and last initial', () => {
    expect(getInitialsFromName('Alice Marie Example')).toBe('AE')
  })

  it('empty string returns ?', () => {
    expect(getInitialsFromName('')).toBe('?')
  })
})
