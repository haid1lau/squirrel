import { useEffect, useMemo, useRef, useState } from 'react'
import { HeroAcorn, type AcornMood } from '../components/acorn/HeroAcorn'
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

  // The acorn shakes when something expires within 3 days, and settles once nothing needs review.
  const mood: AcornMood = tracked?.some(
    (b) => !b.used_on && b.days_until_expiry != null && b.days_until_expiry >= 0 && b.days_until_expiry <= 3,
  )
    ? 'wobble'
    : review && review.length === 0
      ? 'settle'
      : 'idle'

  // The acorn is 5px shorter than the hero, but never wider than 28% of it (from the design).
  const heroRef = useRef<HTMLDivElement>(null)
  const [acornSize, setAcornSize] = useState(0)
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const ro = new ResizeObserver(() => {
      const next = Math.round(Math.max(40, Math.min(hero.offsetHeight - 5, hero.offsetWidth * 0.28)))
      setAcornSize((curr) => (Math.abs(curr - next) > 2 ? next : curr))
    })
    ro.observe(hero)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="grid gap-6">
      <section aria-labelledby="overview-title" className="grid gap-6">
        <div
          ref={heroRef}
          className="glass relative rounded-[20px] px-5 py-5 sm:px-7 sm:py-6"
          style={{ paddingRight: acornSize ? acornSize + 28 : undefined }}
        >
          <h1
            id="overview-title"
            tabIndex={-1}
            className="text-3xl font-extrabold tracking-[-0.02em] outline-none sm:text-[40px] sm:leading-tight"
          >
            {firstName ? `${firstName}’s benefits` : 'Your benefits'}
          </h1>
          <p className="mt-2 text-[17px] text-ink-muted">Memberships, vouchers and card perks as of {formatToday()}.</p>
          {acornSize ? <HeroAcorn mood={mood} size={acornSize} /> : null}
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
