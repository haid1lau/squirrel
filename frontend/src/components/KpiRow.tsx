import { Clock, Ticket, TriangleAlert, type LucideIcon } from 'lucide-react'
import { cn } from '../lib/cn'
import { Card } from './ui/Card'

type KpiTone = 'neutral' | 'warn' | 'danger'

const toneClass: Record<KpiTone, string> = {
  neutral: 'bg-surface-2 text-ink-muted',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
}

function Kpi({ icon: Icon, value, label, tone }: { icon: LucideIcon; value: number | null; label: string; tone: KpiTone }) {
  return (
    <Card className="flex items-center gap-4 p-[22px]">
      <div className={cn('grid size-[46px] shrink-0 place-items-center rounded-xl', toneClass[tone])}>
        <Icon className="size-5" aria-hidden />
      </div>
      <div>
        <p className="text-[28px] leading-tight font-bold tabular-nums">{value ?? '–'}</p>
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
      <Kpi icon={Ticket} value={tracked} label="Tracked benefits" tone="neutral" />
      <Kpi
        icon={Clock}
        value={expiringSoon}
        label="Expiring in 30 days"
        tone={anyWithinWeek ? 'danger' : expiringSoon ? 'warn' : 'neutral'}
      />
      <Kpi icon={TriangleAlert} value={needsReview} label="Waiting for review" tone={needsReview ? 'warn' : 'neutral'} />
    </div>
  )
}
