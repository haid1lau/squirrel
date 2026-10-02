import { cn } from '../../lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'h-3.5 animate-shimmer rounded-md bg-linear-to-r from-surface-2 via-line to-surface-2 bg-size-[200%_100%]',
        className,
      )}
    />
  )
}
