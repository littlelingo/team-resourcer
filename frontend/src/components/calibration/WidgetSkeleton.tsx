import { cn } from '@/lib/utils'

interface WidgetSkeletonProps {
  className?: string
  height?: string
}

export default function WidgetSkeleton({ className, height = 'h-48' }: WidgetSkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg border border-slate-100 bg-slate-50',
        height,
        className,
      )}
    />
  )
}
