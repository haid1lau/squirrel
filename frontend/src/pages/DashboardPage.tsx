import { useMemo } from 'react'
import { ExpiringList } from '../components/ExpiringList'
import { KpiRow } from '../components/KpiRow'
import { ReviewQueue } from '../components/ReviewQueue'
import type { Benefit, User } from '../lib/api'
import { formatToday } from '../lib/format'

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
    const tracked = benefits.filter((b) => !b.needs_review)
    const soon = tracked.filter((b) => b.days_until_expiry != null && b.days_until_expiry >= 0 && b.days_until_expiry <= 30)
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
        <div>
          <h1 id="overview-title" tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none sm:text-3xl">
            {firstName ? `${firstName}’s benefits` : 'Your benefits'}
          </h1>
          <p className="mt-1 text-ink-muted">Memberships, vouchers and card perks as of {formatToday()}.</p>
        </div>

        <KpiRow
          tracked={tracked?.length ?? null}
          expiringSoon={expiringSoon}
          anyWithinWeek={anyWithinWeek}
          needsReview={review?.length ?? null}
        />

        <ExpiringList benefits={tracked} error={error} onRetry={onRetry} />
      </section>

      <ReviewQueue benefits={review} onConfirmed={onConfirmed} onDismissed={onDismissed} />
    </div>
  )
}
