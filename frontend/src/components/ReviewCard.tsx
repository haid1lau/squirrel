import { Check, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, CATEGORIES, errorMessage, type Benefit } from '../lib/api'
import { capitalize } from '../lib/format'
import { flyToBenefits } from '../lib/motion'
import { useToast } from '../lib/toast'
import { Button } from './ui/Button'
import { Message } from './ui/Message'

const DISARM_AFTER_MS = 4000

interface ReviewCardProps {
  benefit: Benefit
  onConfirmed: (benefit: Benefit) => void
  onDismissed: (id: string) => void
}

export function ReviewCard({ benefit, onConfirmed, onDismissed }: ReviewCardProps) {
  const toast = useToast()
  const [expiryDate, setExpiryDate] = useState(benefit.expiry_date ?? '')
  const [busy, setBusy] = useState<'confirm' | 'dismiss' | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Destructive action needs a second click; the first "arms" it for a few seconds.
  const [armed, setArmed] = useState(false)
  const disarmTimer = useRef<number | undefined>(undefined)
  const cardRef = useRef<HTMLElement>(null)
  useEffect(() => () => window.clearTimeout(disarmTimer.current), [])

  const dateId = `expiry-${benefit.id}`
  const hintId = `expiry-hint-${benefit.id}`
  const name = benefit.benefit_name || 'Untitled benefit'

  async function confirm() {
    setBusy('confirm')
    setError(null)
    try {
      const saved = await api.approve(benefit.id, expiryDate)
      // Fly a label to the All Benefits link before the card leaves the queue.
      flyToBenefits(cardRef.current, name)
      onConfirmed(saved)
      toast('success', `Confirmed “${name}”.`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
    }
  }

  async function dismiss() {
    if (!armed) {
      setArmed(true)
      disarmTimer.current = window.setTimeout(() => setArmed(false), DISARM_AFTER_MS)
      return
    }
    window.clearTimeout(disarmTimer.current)
    setBusy('dismiss')
    setError(null)
    try {
      await api.dismiss(benefit.id)
      onDismissed(benefit.id)
      toast('info', `Dismissed “${name}”.`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
      setArmed(false)
    }
  }

  const meta = [
    benefit.provider,
    capitalize(benefit.type),
    // Skipped when it adds nothing ("Others", or the same word as the type, like Travel).
    !['other', benefit.type].includes(benefit.category) && CATEGORIES[benefit.category],
    benefit.value,
  ].filter(Boolean)

  return (
    <article
      ref={cardRef}
      aria-labelledby={`review-${benefit.id}`}
      className="grid content-start gap-3 rounded-xl border border-line p-4"
    >
      <div>
        <h3 id={`review-${benefit.id}`} className="font-semibold">
          {name}
        </h3>
        <p className="text-sm text-ink-muted">{meta.join(' · ')}</p>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{capitalize(benefit.review_reason ?? 'Needs a second look')}</span>
      </p>

      {benefit.source === 'loyalty' ? <p className="text-sm text-ink-muted">{benefit.expiry_reasoning}</p> : null}

      {benefit.source_snippet ? (
        <blockquote className="border-l-2 border-line pl-3 text-sm text-ink-muted italic [overflow-wrap:anywhere]">
          “{benefit.source_snippet}”
        </blockquote>
      ) : null}

      <div className="grid gap-1.5">
        <label htmlFor={dateId} className="text-sm font-semibold">
          Expiry date
        </label>
        <input
          id={dateId}
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          aria-describedby={hintId}
          className="min-h-11 rounded-xl border border-line bg-surface px-3 transition-colors duration-150 hover:border-ink-muted/50 focus:border-primary"
        />
        <p id={hintId} className="text-xs text-ink-muted">
          Leave empty to track it with no expiry.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon={<Check className="size-4" aria-hidden />}
          loading={busy === 'confirm'}
          loadingLabel="Saving…"
          onClick={confirm}
        >
          Confirm
        </Button>
        <Button
          variant="danger"
          icon={<X className="size-4" aria-hidden />}
          loading={busy === 'dismiss'}
          loadingLabel="Removing…"
          onClick={dismiss}
          className={armed ? 'border-danger bg-danger-soft' : undefined}
        >
          {armed ? 'Click again to dismiss' : 'Dismiss'}
        </Button>
      </div>

      {error ? <Message tone="error">{error}</Message> : null}
    </article>
  )
}
