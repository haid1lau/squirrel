import { useMemo } from 'react'
import { ExpiringList } from '../components/ExpiringList'
import { KpiRow } from '../components/KpiRow'
import { ReviewQueue } from '../components/ReviewQueue'
import type { Benefit, User } from '../lib/api'
import { formatToday } from '../lib/format'
import { isArchived } from '../lib/usage'

interface DashboardPageProps {
  user: User
  benefits: Benefit[] | null
  error: string | null
  onRetry: () => void
  onConfirmed: (benefit: Benefit) => void
  onDismissed: (id: string) => void
}

export function DashboardPage({ user, benefits, error, onRetry, onConfirmed, onDismissed }: DashboardPageProps) {
  // Derived during render rather than stored, so it can never go stale.
  const { tracked, review, expiringSoon, anyWithinWeek } = useMemo(() => {
    if (!benefits) return { tracked: null, review: null, expiringSoon: null, anyWithinWeek: false }
    // Used-up benefits aren't tracked any more; a used-up card credit still shows until it resets.
    const tracked = benefits.filter((b) => !b.needs_review && !isArchived(b))
    const soon = tracked.filter(
      (b) => !b.used_on && b.days_until_expiry != null && b.days_until_expiry >= 0 && b.days_until_expiry <= 30,
    )
    return {
      tracked,
      review: benefits.filter((b) => b.needs_review),
      expiringSoon: soon.length,
      anyWithinWeek: soon.some((b) => (b.days_until_expiry ?? Infinity) <= 7),
    }
  }, [benefits])

  const firstName = user.name?.split(' ')[0]

  return (
    <div className="grid gap-6">
      <section aria-labelledby="overview-title" className="grid gap-6">
        <div className="glass rounded-[20px] px-5 py-5 sm:px-7 sm:py-6">
          <h1
            id="overview-title"
            tabIndex={-1}
            className="text-3xl font-extrabold tracking-[-0.02em] outline-none sm:text-[40px] sm:leading-tight"
          >
            {firstName ? `${firstName}’s benefits` : 'Your benefits'}
          </h1>
          <p className="mt-2 text-[17px] text-ink-muted">Memberships, vouchers and card perks as of {formatToday()}.</p>
        </div>

        <KpiRow
          tracked={tracked?.length ?? null}
          expiringSoon={expiringSoon}
          anyWithinWeek={anyWithinWeek}
          needsReview={review?.length ?? null}
        />

        <ExpiringList
          benefits={tracked}
          error={error}
          onRetry={onRetry}
          onUpdated={onConfirmed}
          onRemoved={onDismissed}
        />
      </section>

      <ReviewQueue benefits={review} onConfirmed={onConfirmed} onDismissed={onDismissed} />
    </div>
  )
}
