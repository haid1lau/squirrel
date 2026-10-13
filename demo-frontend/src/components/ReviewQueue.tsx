import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Benefit } from '../lib/api'
import { cn } from '../lib/cn'
import { celebrate } from '../lib/motion'
import { DiggingSquirrel } from './DiggingSquirrel'
import { ReviewCard } from './ReviewCard'
import { Card, CardHeader, CountChip } from './ui/Card'
import { Skeleton } from './ui/Skeleton'

interface ReviewQueueProps {
  benefits: Benefit[] | null
  onConfirmed: (benefit: Benefit) => void
  onDismissed: (id: string) => void
}

/** What a queued item needs, in a few words, for the list beside the stack. */
function shortReason(b: Benefit) {
  if (b.source === 'loyalty') return 'Confirm membership'
  if (b.expiry_confidence === 'ambiguous') return 'Date unclear'
  if (b.expiry_confidence === 'unknown') return 'No date found'
  return 'Needs a look'
}

export function ReviewQueue({ benefits, onConfirmed, onDismissed }: ReviewQueueProps) {
  // Clearing the last item gets falling acorns (not on a page that loads already empty).
  const count = benefits?.length ?? null
  const prevCount = useRef(count)
  useEffect(() => {
    if (prevCount.current && count === 0) celebrate(400)
    prevCount.current = count
  }, [count])

  // The card on top of the stack: the one picked from the list, else the first.
  const [pickedId, setPickedId] = useState<string | null>(null)
  const current = benefits?.find((b) => b.id === pickedId) ?? benefits?.[0] ?? null
  const index = benefits && current ? benefits.indexOf(current) : -1

  // Moving between items turns the card like a page: the current one turns away (`turning`),
  // then the next turns in from the other side (`enterDir`). 1 is forwards, -1 back.
  const [turning, setTurning] = useState<{ to: string; dir: 1 | -1 } | null>(null)
  const [enterDir, setEnterDir] = useState<1 | -1 | null>(null)
  const show = (id: string, dir: 1 | -1) => {
    if (turning || !current || id === current.id) return
    setTurning({ to: id, dir })
  }
  /** Looks at the previous or next item without keeping or dismissing this one (wraps around). */
  const step = (by: 1 | -1) => {
    if (!benefits?.length) return
    show(benefits[(index + by + benefits.length) % benefits.length].id, by)
  }
  /** Jumps to an item from the list, turning forwards or back depending on where it is. */
  const pick = (b: Benefit) => benefits && show(b.id, benefits.indexOf(b) > index ? 1 : -1)

  return (
    <Card as="section" id="review" aria-labelledby="review-title">
      <CardHeader
        icon={TriangleAlert}
        title="Review queue"
        titleId="review-title"
        action={benefits ? <CountChip>{benefits.length ? `${benefits.length} waiting` : 'All clear'}</CountChip> : null}
      />
      <div className="p-5 sm:p-6">
        {!benefits ? (
          <Skeleton className="h-64 rounded-[28px]" />
        ) : benefits.length === 0 || !current ? (
          <div className="grid justify-items-center gap-2 py-8 text-center text-ink-muted">
            <DiggingSquirrel className="size-[132px]" />
            <p className="text-[17px] font-semibold text-ink">All caught up</p>
            <p>Every tracked benefit has a date you can trust.</p>
          </div>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="grid gap-3">
              <p className="text-sm text-ink-muted">Found in your email. Check each one before it’s tracked.</p>
              {/* Browse the queue without deciding: previous / next, on every screen size. */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => step(-1)}
                  disabled={benefits.length < 2}
                  aria-label="Previous item"
                  className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-surface transition-colors duration-150 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <p className="flex-1 text-center text-sm font-semibold tabular-nums" aria-live="polite">
                  {index + 1} of {benefits.length}
                </p>
                <button
                  type="button"
                  onClick={() => step(1)}
                  disabled={benefits.length < 2}
                  aria-label="Next item"
                  className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-line bg-surface transition-colors duration-150 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </div>
              {/* Phones: tap a segment to jump to that item. Wider screens: the whole queue as a list. */}
              <div className="grid grid-flow-col gap-1 lg:hidden">
                {benefits.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => pick(b)}
                    aria-label={`Show item ${i + 1}: ${b.benefit_name || 'Untitled benefit'}`}
                    aria-current={b.id === current.id || undefined}
                    className="grid h-6 cursor-pointer items-center"
                  >
                    <span className={cn('h-1 rounded-full', b.id === current.id ? 'bg-[#FCD34D]' : 'bg-line')} />
                  </button>
                ))}
              </div>
              <ol className="hidden gap-1.5 lg:grid" aria-label="Waiting for review">
                {benefits.map((b, i) => {
                  const on = b.id === current.id
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        aria-current={on || undefined}
                        onClick={() => pick(b)}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-colors duration-150',
                          on ? 'border-[#FCD34D]/70 bg-warn-soft' : 'border-transparent hover:bg-surface-2',
                        )}
                      >
                        <span
                          className={cn(
                            'grid size-7 shrink-0 place-items-center rounded-full text-xs font-extrabold',
                            on ? 'bg-[#FCD34D] text-[#1C1917]' : 'bg-surface-2 text-ink-muted',
                          )}
                        >
                          {i + 1}
                        </span>
                        <span className="grid min-w-0">
                          <span className="truncate text-[15px] font-bold">{b.benefit_name || 'Untitled benefit'}</span>
                          <span className="truncate text-[13px] text-ink-muted">
                            {b.provider ? `${b.provider} · ` : ''}
                            {shortReason(b)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
            {/* Keyed, so each item starts fresh (centred, not armed). */}
            <ReviewCard
              key={current.id}
              benefit={current}
              onConfirmed={onConfirmed}
              onDismissed={onDismissed}
              turnAway={turning?.dir}
              onTurnedAway={() => {
                if (!turning) return
                setPickedId(turning.to)
                setEnterDir(turning.dir)
                setTurning(null)
              }}
              turnIn={enterDir}
              onTurnedIn={() => setEnterDir(null)}
            />
          </div>
        )}
      </div>
    </Card>
  )
}
