import { Clock } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '../lib/cn'
import { urgency, type Tone } from '../lib/format'
import { prefersReducedMotion } from '../lib/motion'

const toneClass: Record<Tone, string> = {
  danger: 'bg-danger-soft text-danger',
  warn: 'bg-warn-soft text-warn',
  ok: 'bg-ok-soft text-ok',
  neutral: 'bg-surface-2 text-ink-muted',
}

export function UrgencyBadge({ days }: { days: number | null }) {
  const { tone, label } = urgency(days)
  const ref = useRef<HTMLSpanElement>(null)
  const urgent = days != null && days >= 0 && days <= 3

  // Expiring within 3 days: one pulse the first time it scrolls into view.
  useEffect(() => {
    const el = ref.current
    if (!urgent || !el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        el.animate(
          prefersReducedMotion()
            ? [{ opacity: 0.4 }, { opacity: 1 }]
            : [
                { transform: 'scale(1)', boxShadow: '0 0 0 0 rgb(239 68 68 / 0.55)' },
                { transform: 'scale(1.1)', boxShadow: '0 0 0 8px rgb(239 68 68 / 0)', offset: 0.45 },
                { transform: 'scale(1)', boxShadow: '0 0 0 0 rgb(239 68 68 / 0)' },
              ],
          { duration: prefersReducedMotion() ? 300 : 650, easing: 'ease-out' },
        )
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [urgent])

  return (
    <span
      ref={ref}
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
