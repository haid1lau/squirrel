import { CircleCheck, TriangleAlert } from 'lucide-react'
import type { Benefit } from '../lib/api'
import { ReviewCard } from './ReviewCard'
import { Card, CardHeader, CountChip } from './ui/Card'
import { Skeleton } from './ui/Skeleton'

interface ReviewQueueProps {
  benefits: Benefit[] | null
  onConfirmed: (benefit: Benefit) => void
  onDismissed: (id: string) => void
}

export function ReviewQueue({ benefits, onConfirmed, onDismissed }: ReviewQueueProps) {
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
          <div className="col-span-full grid justify-items-center gap-1.5 py-8 text-center text-ink-muted">
            <CircleCheck className="size-7 text-ok" aria-hidden />
            <p className="font-semibold text-ink">Nothing to review</p>
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
