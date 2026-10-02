import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Benefit } from '../lib/api'
import { celebrate } from '../lib/motion'
import { ReviewCard } from './ReviewCard'
import { Card, CardHeader, CountChip } from './ui/Card'
import { Skeleton } from './ui/Skeleton'

interface ReviewQueueProps {
  benefits: Benefit[] | null
  onConfirmed: (benefit: Benefit) => void
  onDismissed: (id: string) => void
}

/** The squirrel burying an acorn, from the Claude Design file (shapes in category-scenes.svg). */
function CaughtUpSquirrel() {
  return (
    <div
      aria-hidden
      className="size-[132px] overflow-hidden rounded-full"
      style={{ background: 'oklch(0.93 0.045 55)' }}
    >
      <svg viewBox="0 0 200 200" className="block size-full">
        <g className="animate-dig" style={{ transformOrigin: '96px 180px' }}>
          <use href="#sq-tail" transform="translate(114 150)" />
          <use href="#sq-body" transform="translate(96 138)" />
          <use href="#sq-head" transform="translate(96 76)" />
          <use href="#eyes-happy" transform="translate(96 76)" />
          <use href="#sq-hand" transform="translate(74 158)" />
          <use href="#sq-hand" transform="translate(118 158)" />
        </g>
        <g className="animate-bury" style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
          <ellipse cx="100" cy="166" rx="9" ry="11" fill="#c97a3d" stroke="#2b2520" strokeWidth="3" />
          <path d="M89 160 Q100 148 111 160 Z" fill="#7a4a26" stroke="#2b2520" strokeWidth="3" strokeLinejoin="round" />
        </g>
        <path
          d="M30 200 L30 188 Q100 160 170 188 L170 200 Z"
          fill="#9a6a43"
          stroke="#2b2520"
          strokeWidth="4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function ReviewQueue({ benefits, onConfirmed, onDismissed }: ReviewQueueProps) {
  // Clearing the last item is a big win: falling acorns (not on a page that loads already empty).
  const count = benefits?.length ?? null
  const prevCount = useRef(count)
  useEffect(() => {
    if (prevCount.current && count === 0) celebrate(400)
    prevCount.current = count
  }, [count])

  return (
    <Card as="section" id="review" aria-labelledby="review-title">
      <CardHeader
        icon={TriangleAlert}
        title="Review queue"
        titleId="review-title"
        action={benefits ? <CountChip>{benefits.length ? `${benefits.length} waiting` : 'All clear'}</CountChip> : null}
      />
      <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        {!benefits ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : benefits.length === 0 ? (
          <div className="col-span-full grid justify-items-center gap-2 py-8 text-center text-ink-muted">
            <CaughtUpSquirrel />
            <p className="text-[17px] font-semibold text-ink">All caught up</p>
            <p>Every tracked benefit has a date you can trust.</p>
          </div>
        ) : (
          benefits.map((b) => (
            <ReviewCard key={b.id} benefit={b} onConfirmed={onConfirmed} onDismissed={onDismissed} />
          ))
        )}
      </div>
    </Card>
  )
}
