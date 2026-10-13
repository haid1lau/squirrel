import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type Tone = 'success' | 'warn' | 'error' | 'info'

const styles: Record<Tone, { className: string; icon: LucideIcon }> = {
  success: { className: 'bg-ok-soft text-ok', icon: CircleCheck },
  warn: { className: 'bg-warn-soft text-warn', icon: TriangleAlert },
  error: { className: 'bg-danger-soft text-danger', icon: CircleAlert },
  info: { className: 'bg-surface-2 text-ink-muted', icon: Info },
}

/** Errors use role="alert" so screen readers announce them immediately. */
export function Message({ tone, children }: { tone: Tone; children: ReactNode }) {
  const { className, icon: Icon } = styles[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex animate-rise items-start gap-2.5 rounded-xl px-3.5 py-3 text-sm', className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  )
}
