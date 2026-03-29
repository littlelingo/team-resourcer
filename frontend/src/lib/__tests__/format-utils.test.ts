import { formatCurrency, formatNumber } from '@/lib/format-utils'

describe('formatCurrency', () => {
  it('formats a whole number decimal string', () => {
    expect(formatCurrency('120000.00')).toBe('$120,000.00')
  })

  it('formats a decimal with cents', () => {
    expect(formatCurrency('15000.50')).toBe('$15,000.50')
  })

  it('formats zero', () => {
    expect(formatCurrency('0.00')).toBe('$0.00')
  })

  it('passes through non-numeric strings', () => {
    expect(formatCurrency('abc')).toBe('abc')
  })

  it('returns null for null', () => {
    expect(formatCurrency(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatCurrency(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(formatCurrency('')).toBeNull()
  })
})

describe('formatNumber', () => {
  it('strips trailing zeros from whole number', () => {
    expect(formatNumber('40.00')).toBe('40')
  })

  it('preserves significant decimal digits', () => {
    expect(formatNumber('40.50')).toBe('40.5')
  })

  it('formats zero', () => {
    expect(formatNumber('0.00')).toBe('0')
  })

  it('passes through non-numeric strings', () => {
    expect(formatNumber('abc')).toBe('abc')
  })

  it('returns null for null', () => {
    expect(formatNumber(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(formatNumber(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(formatNumber('')).toBeNull()
  })
})
