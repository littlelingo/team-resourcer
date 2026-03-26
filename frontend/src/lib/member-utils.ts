export function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim()
  const last = lastName.trim()
  if (!first && !last) return '?'
  if (!last) return first.slice(0, 2).toUpperCase()
  return (first[0] + last[0]).toUpperCase()
}

/** Derive initials from a pre-computed full name string (e.g. tree node data). */
export function getInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
