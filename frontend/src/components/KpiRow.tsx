import { Clock, Ticket, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'
import { useReducedMotion } from '../lib/motion'
import { Card } from './ui/Card'

type KpiTone = 'neutral' | 'warn' | 'danger'

const toneClass: Record<KpiTone, string> = {
  neutral: 'bg-surface-2 text-ink-muted',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
}

const COUNT_MS = 450

/** Counts up from 0 the first time a number arrives (ease-out), then shows changes straight away. */
function useCountUp(value: number | null) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState<number | null>(reduced ? value : null)
  const [done, setDone] = useState(reduced)
  useEffect(() => {
    if (value == null || done) return
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / COUNT_MS)
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
      else setDone(true)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, done])
  if (value == null) return null
  return done ? value : (shown ?? 0)
}

interface KpiProps {
  icon: LucideIcon
  value: number | null
  label: string
  tone: KpiTone
  /** Position in the row, for the staggered entrance. */
  index: number
}

function Kpi({ icon: Icon, value, label, tone, index }: KpiProps) {
  const shown = useCountUp(value)
  return (
    <Card className="flex animate-rise items-center gap-4 p-[22px]" style={{ animationDelay: `${index * 40}ms` }}>
      <div className={cn('grid size-[46px] shrink-0 place-items-center rounded-xl', toneClass[tone])}>
        <Icon className="size-5" aria-hidden />
      </div>
      <div>
        <p className="text-[28px] leading-tight font-bold tabular-nums">
          {/* Screen readers get the final number, not each step. */}
          <span aria-hidden>{shown ?? '–'}</span>
          <span className="sr-only">{value ?? 'Loading'}</span>
        </p>
        <p className="text-sm text-ink-muted">{label}</p>
      </div>
    </Card>
  )
}

interface KpiRowProps {
  tracked: number | null
  expiringSoon: number | null
  anyWithinWeek: boolean
  needsReview: number | null
}

export function KpiRow({ tracked, expiringSoon, anyWithinWeek, needsReview }: KpiRowProps) {
  return (
    <div className="grid gap-[18px] sm:grid-cols-3" aria-live="polite">
      <Kpi icon={Ticket} value={tracked} label="Tracked benefits" tone="neutral" index={0} />
      <Kpi
        icon={Clock}
        value={expiringSoon}
        label="Expiring in 30 days"
        tone={anyWithinWeek ? 'danger' : expiringSoon ? 'warn' : 'neutral'}
        index={1}
      />
      <Kpi
        icon={TriangleAlert}
        value={needsReview}
        label="Waiting for review"
        tone={needsReview ? 'warn' : 'neutral'}
        index={2}
      />
    </div>
  )
}
