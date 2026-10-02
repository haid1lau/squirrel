import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Benefit } from '../lib/api'
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

export function ReviewQueue({ benefits, onConfirmed, onDismissed }: ReviewQueueProps) {
  // Clearing the last item gets falling acorns (not on a page that loads already empty).
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
            <DiggingSquirrel className="size-[132px]" />
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
