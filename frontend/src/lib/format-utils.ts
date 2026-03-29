export function formatCurrency(value: string | null | undefined): string | null {
  if (!value) return null
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

export function formatNumber(value: string | null | undefined): string | null {
  if (!value) return null
  const num = parseFloat(value)
  if (isNaN(num)) return value
  return num.toString()
}
