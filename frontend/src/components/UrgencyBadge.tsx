import { Clock } from 'lucide-react'
import { cn } from '../lib/cn'
import { urgency, type Tone } from '../lib/format'

const toneClass: Record<Tone, string> = {
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn',
  ok: 'bg-ok-soft text-ok',
  neutral: 'bg-surface-2 text-ink-muted',
}

export function UrgencyBadge({ days }: { days: number | null }) {
  const { tone, label } = urgency(days)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        toneClass[tone],
      )}
    >
      <Clock className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}
