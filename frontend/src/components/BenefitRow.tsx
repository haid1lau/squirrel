import { ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import { CATEGORIES, REMINDER_DAYS, type Benefit } from '../lib/api'
import { cn } from '../lib/cn'
import { capitalize, formatDate, formatPoints, urgency } from '../lib/format'
import { UrgencyBadge } from './UrgencyBadge'

const METER_WINDOW_DAYS = 90
const meterTone = { danger: 'bg-danger', warn: 'bg-warn', ok: 'bg-ok', neutral: 'bg-line' }

/** One benefit as a list item. `children` (e.g. action buttons) render under the details. */
export function BenefitRow({ benefit, children }: { benefit: Benefit; children?: ReactNode }) {
  const days = benefit.days_until_expiry
  const { tone } = urgency(days)
  const meta = [
    {
      card: 'Card perk',
      gmail: 'From Gmail',
      imap: `From ${benefit.source_account ?? 'email'}`,
      loyalty: 'Membership found in your email',
      manual: 'Added by you',
    }[benefit.source],
    benefit.provider,
    capitalize(benefit.type),
    // Skipped when it adds nothing ("Others", or the same word as the type, like Travel).
    !['other', benefit.type].includes(benefit.category) && CATEGORIES[benefit.category],
    benefit.points != null ? formatPoints(benefit.points, benefit.points_unit) : benefit.value,
    benefit.expiry_date && `Expires ${formatDate(benefit.expiry_date)}`,
    // Only a benefit's own reminder is shown; the usual one is set on the dashboard.
    benefit.expiry_date && benefit.reminder === 'off' && 'No reminder',
    benefit.expiry_date &&
      typeof benefit.reminder === 'number' &&
      `Reminder ${REMINDER_DAYS[benefit.reminder]?.toLowerCase()}`,
  ].filter(Boolean)
  // A fuller bar means closer to expiry, across a 90-day window.
  const fill = days == null ? null : Math.max(4, Math.min(100, 100 - (Math.max(days, 0) / METER_WINDOW_DAYS) * 100))

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4">
      <div className="min-w-0">
        <p className="font-semibold">{benefit.benefit_name || 'Untitled benefit'}</p>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink-muted">
          {meta.map((m, i) => (
            // Static per render and never reordered, so the index is a safe key.
            <span key={i}>{m}</span>
          ))}
        </p>
      </div>
      {benefit.needs_review ? (
        <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-warn">
          Needs review
        </span>
      ) : (
        <UrgencyBadge days={days} />
      )}
      {fill !== null && !benefit.needs_review ? (
        <div className="col-span-2 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className={cn('h-full rounded-full', meterTone[tone])} style={{ width: `${fill}%` }} />
        </div>
      ) : null}
      {benefit.terms_summary ? <p className="col-span-2 text-sm text-ink-muted">{benefit.terms_summary}</p> : null}
      {benefit.source_link ? (
        <a
          href={benefit.source_link}
          target="_blank"
          rel="noreferrer"
          className="col-span-2 inline-flex min-h-11 items-center gap-1.5 justify-self-start text-sm font-semibold text-primary-text underline-offset-4 hover:underline"
        >
          <ExternalLink className="size-4" aria-hidden />
          Open the email<span className="sr-only"> for {benefit.benefit_name} (opens Gmail in a new tab)</span>
        </a>
      ) : null}
      {children ? <div className="col-span-2">{children}</div> : null}
    </li>
  )
}
