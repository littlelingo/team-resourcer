/**
 * FilterTransitions — framer-motion layout animation layer.
 * Wraps member chips in NineBoxGrid / other widgets so they
 * animate between positions when filters change.
 *
 * Usage: wrap chips in <FilterTransition memberUuid={uuid}>.
 * This is an always-on utility; it is NOT toggled via the widget registry.
 */
import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

interface FilterTransitionProps {
  memberUuid: string
  children: ReactNode
  className?: string
}

export function FilterTransition({ memberUuid, children, className }: FilterTransitionProps) {
  return (
    <motion.div
      layout
      layoutId={`member-chip-${memberUuid}`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Re-export as default so the widget registry lazy-import works
export default function FilterTransitions() {
  return null // Always-on layer — no direct render needed
}
