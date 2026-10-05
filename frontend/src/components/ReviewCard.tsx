import { Check, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { api, CATEGORIES, errorMessage, type Benefit } from '../lib/api'
import { cn } from '../lib/cn'
import { capitalize } from '../lib/format'
import { flyToBenefits, prefersReducedMotion } from '../lib/motion'
import { useToast } from '../lib/toast'
import { CategoryArt } from './CategoryArt'
import { Message } from './ui/Message'

const DISARM_AFTER_MS = 4000
/** How far (px) the card must be dragged to count as a swipe. */
const SWIPE_PX = 110
const FLY_MS = 260

const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** One-tap dates for when the email only says "this season" or "this year". */
function quickDates() {
  const now = new Date()
  return [
    { label: 'End of this month', value: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) },
    { label: 'End of next month', value: isoDate(new Date(now.getFullYear(), now.getMonth() + 2, 0)) },
    { label: 'End of the year', value: isoDate(new Date(now.getFullYear(), 11, 31)) },
    { label: 'No expiry', value: '' },
  ]
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

interface ReviewCardProps {
  benefit: Benefit
  onConfirmed: (benefit: Benefit) => void
  onDismissed: (id: string) => void
  /** Set to turn this card away like a page (1 forwards, -1 back); onTurnedAway runs when it's gone. */
  turnAway?: 1 | -1
  onTurnedAway?: () => void
  /** Turns the card in from the other side when it first shows; onTurnedIn runs when it's done. */
  turnIn?: 1 | -1 | null
  onTurnedIn?: () => void
}

const TURN_MS = 240
const PERSPECTIVE = 'perspective(1400px)'

/**
 * A page turn in two halves around the card's edge: away to 90° (edge-on, shaded), then the next card
 * in from -90° on the opposite edge. Forwards pivots on the left edge, like turning a book's page.
 */
function turnKeyframes(dir: 1 | -1, phase: 'away' | 'in'): Keyframe[] {
  const edge = (phase === 'away') === (dir === 1) ? 'left' : 'right'
  const angle = (phase === 'away' ? -90 : 90) * dir
  const flat = { transform: `${PERSPECTIVE} rotateY(0deg)`, filter: 'brightness(1)', transformOrigin: `${edge} center` }
  const edgeOn = { transform: `${PERSPECTIVE} rotateY(${angle}deg)`, filter: 'brightness(0.7)', transformOrigin: `${edge} center` }
  return phase === 'away' ? [flat, edgeOn] : [edgeOn, flat]
}

/**
 * The top card of the review stack. Drag it right (or press →) to keep it, left (or ←) to dismiss.
 * Dismissing needs a second swipe or click, as before; the first one "arms" it for a few seconds.
 */
export function ReviewCard({
  benefit,
  onConfirmed,
  onDismissed,
  turnAway,
  onTurnedAway,
  turnIn,
  onTurnedIn,
}: ReviewCardProps) {
  const toast = useToast()
  const [expiryDate, setExpiryDate] = useState(benefit.expiry_date ?? '')
  const [busy, setBusy] = useState<'confirm' | 'dismiss' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [armed, setArmed] = useState(false)
  const disarmTimer = useRef<number | undefined>(undefined)
  const cardRef = useRef<HTMLElement>(null)
  useEffect(() => () => window.clearTimeout(disarmTimer.current), [])

  // The page turn (a fade with Reduce Motion). Each callback is read once, when its turn starts.
  const turnedAway = useRef(onTurnedAway)
  turnedAway.current = onTurnedAway
  useEffect(() => {
    const card = cardRef.current
    if (!turnAway || !card) return
    const rm = prefersReducedMotion()
    const anim = card.animate(rm ? [{ opacity: 1 }, { opacity: 0 }] : turnKeyframes(turnAway, 'away'), {
      duration: rm ? 120 : TURN_MS,
      easing: 'cubic-bezier(.55,0,.9,.4)',
      fill: 'forwards',
    })
    anim.onfinish = () => turnedAway.current?.()
    return () => anim.cancel()
  }, [turnAway])
  const turnedIn = useRef(onTurnedIn)
  turnedIn.current = onTurnedIn
  useEffect(() => {
    const card = cardRef.current
    if (!turnIn || !card) return
    const rm = prefersReducedMotion()
    const anim = card.animate(rm ? [{ opacity: 0 }, { opacity: 1 }] : turnKeyframes(turnIn, 'in'), {
      duration: rm ? 120 : TURN_MS,
      easing: 'cubic-bezier(.1,.6,.45,1)',
    })
    anim.onfinish = () => turnedIn.current?.()
    // Only on first show: later renders keep the card where it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Dragging: the card follows the pointer, tilting as it goes.
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; id: number } | null>(null)

  const dateId = `expiry-${benefit.id}`
  const hintId = `expiry-hint-${benefit.id}`
  const name = benefit.benefit_name || 'Untitled benefit'

  /** Slides the card off one side before it leaves the stack. */
  async function flyOff(direction: 1 | -1) {
    if (prefersReducedMotion()) return
    setDx(direction * 640)
    await new Promise((r) => window.setTimeout(r, FLY_MS))
  }

  async function confirm() {
    if (busy) return
    setBusy('confirm')
    setError(null)
    try {
      const saved = await api.approve(benefit.id, expiryDate)
      // Fly a label to the All Benefits link before the card leaves the queue.
      flyToBenefits(cardRef.current, name)
      await flyOff(1)
      onConfirmed(saved)
      toast('success', `Confirmed “${name}”.`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
      setDx(0)
    }
  }

  async function dismiss() {
    if (busy) return
    if (!armed) {
      setArmed(true)
      setDx(0)
      window.clearTimeout(disarmTimer.current)
      disarmTimer.current = window.setTimeout(() => setArmed(false), DISARM_AFTER_MS)
      return
    }
    window.clearTimeout(disarmTimer.current)
    setBusy('dismiss')
    setError(null)
    try {
      await api.dismiss(benefit.id)
      await flyOff(-1)
      onDismissed(benefit.id)
      toast('info', `Dismissed “${name}”.`)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
      setArmed(false)
      setDx(0)
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLElement>) {
    // Fields and buttons on the card work as normal; drag from anywhere else.
    if (busy || e.button !== 0 || (e.target as HTMLElement).closest('input, button, a, label, select')) return
    start.current = { x: e.clientX, id: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  function onPointerMove(e: ReactPointerEvent<HTMLElement>) {
    if (start.current?.id === e.pointerId) setDx(e.clientX - start.current.x)
  }
  function onPointerUp(e: ReactPointerEvent<HTMLElement>) {
    if (start.current?.id !== e.pointerId) return
    start.current = null
    setDragging(false)
    if (dx > SWIPE_PX) void confirm()
    else if (dx < -SWIPE_PX) void dismiss()
    else setDx(0)
  }

  // ← and → while focus is anywhere in the review area (not while typing a date).
  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey || TYPING_TAGS.has((e.target as HTMLElement).tagName)) return
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      void confirm()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      void dismiss()
    }
  }

  const meta = [
    benefit.provider,
    capitalize(benefit.type),
    // Skipped when it adds nothing ("Others", or the same word as the type, like Travel).
    !['other', benefit.type].includes(benefit.category) && CATEGORIES[benefit.category],
    benefit.value,
  ].filter(Boolean)

  const stamp = dx > 30 ? 'keep' : dx < -30 || armed ? 'dismiss' : null
  const stampOpacity = armed && dx === 0 ? 0.85 : Math.min(1, Math.abs(dx) / SWIPE_PX)

  return (
    <div className="grid justify-items-center gap-5" onKeyDown={onKeyDown}>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:flex-nowrap sm:gap-8">
        <button
          type="button"
          onClick={dismiss}
          aria-disabled={busy !== null || undefined}
          aria-label={armed ? `Click again to dismiss ${name}` : `Dismiss ${name}`}
          title={armed ? 'Click again to dismiss' : 'Dismiss (←)'}
          className={cn(
            'order-2 grid size-16 shrink-0 cursor-pointer place-items-center rounded-full border-2 border-danger/60 bg-danger-soft text-danger transition-transform duration-150 hover:scale-105 active:scale-95 sm:order-1 sm:size-20',
            armed && 'animate-pulse border-danger',
          )}
        >
          <X className="size-7 sm:size-8" strokeWidth={2.4} aria-hidden />
        </button>

        {/* The stack: two cards peek out behind the one being reviewed. */}
        <div className="relative order-1 w-full max-w-[460px] sm:order-2">
          <div aria-hidden className="absolute inset-x-6 top-6 -bottom-2 rotate-3 rounded-[28px] bg-surface-2" />
          <div aria-hidden className="absolute inset-x-3 top-3 -bottom-1 -rotate-2 rounded-[28px] bg-surface-2/80" />
          <article
            ref={cardRef}
            aria-labelledby={`review-${benefit.id}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{
              transform: `translateX(${dx}px) rotate(${dx / 22}deg)`,
              transition: dragging ? 'none' : `transform ${FLY_MS}ms cubic-bezier(.2,.8,.2,1)`,
            }}
            className="glass-float relative grid touch-pan-y cursor-grab content-start gap-4 rounded-[28px] p-6 select-none active:cursor-grabbing sm:p-7"
          >
            {stamp ? (
              <span
                aria-hidden
                style={{ opacity: stampOpacity }}
                className={cn(
                  'pointer-events-none absolute top-6 right-6 rounded-lg border-[3px] px-2.5 text-xl font-extrabold tracking-[0.06em]',
                  stamp === 'keep' ? 'rotate-12 border-ok text-ok' : '-rotate-12 border-danger text-danger',
                )}
              >
                {stamp === 'keep' ? 'KEEP' : 'DISMISS'}
              </span>
            ) : null}

            <CategoryArt category={benefit.category} className="size-16" />
            <div>
              <p className="text-sm text-ink-muted">{meta.join(' · ')}</p>
              <h3 id={`review-${benefit.id}`} className="text-[28px] leading-tight font-extrabold tracking-[-0.02em]">
                {name}
              </h3>
            </div>

            <p className="flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2 text-sm font-semibold text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{capitalize(benefit.review_reason ?? 'Needs a second look')}</span>
            </p>

            {benefit.source === 'loyalty' ? <p className="text-sm text-ink-muted">{benefit.expiry_reasoning}</p> : null}

            {benefit.source_snippet ? (
              <blockquote className="rounded-2xl bg-surface-2 px-4 py-3 text-[15px] text-ink-muted [overflow-wrap:anywhere]">
                “{benefit.source_snippet}”
              </blockquote>
            ) : null}

            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-semibold">Expiry date</legend>
              <div className="flex flex-wrap gap-2">
                {quickDates().map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    aria-pressed={expiryDate === d.value}
                    onClick={() => setExpiryDate(d.value)}
                    className={cn(
                      'min-h-10 cursor-pointer rounded-full border px-3.5 text-sm font-medium transition-colors duration-150',
                      expiryDate === d.value
                        ? 'border-transparent bg-ink text-bg'
                        : 'border-line bg-surface hover:bg-surface-2',
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <label htmlFor={dateId} className="sr-only">
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
                Or pick any date. Leave it empty to track it with no expiry.
              </p>
            </fieldset>

            {error ? <Message tone="error">{error}</Message> : null}
          </article>
        </div>

        <button
          type="button"
          onClick={confirm}
          aria-disabled={busy !== null || undefined}
          aria-label={`Confirm ${name}`}
          title="Keep (→)"
          className="order-3 grid size-16 shrink-0 cursor-pointer place-items-center rounded-full bg-[#86EFAC] text-[#052E16] transition-transform duration-150 hover:scale-105 active:scale-95 sm:size-20"
        >
          <Check className="size-8" strokeWidth={2.6} aria-hidden />
        </button>
      </div>

      <p className="hidden flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-ink-muted sm:flex">
        <span className="flex items-center gap-2">
          <kbd className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-sans text-xs font-semibold">←</kbd> Dismiss
        </span>
        <span className="flex items-center gap-2">
          <kbd className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-sans text-xs font-semibold">→</kbd> Keep
        </span>
        <span>or drag the card</span>
      </p>
      <p className="text-sm text-ink-muted sm:hidden">Swipe right to keep, left to dismiss.</p>
      {armed ? (
        <p role="status" className="text-sm font-semibold text-danger">
          Swipe or click dismiss again to remove it.
        </p>
      ) : null}
    </div>
  )
}
