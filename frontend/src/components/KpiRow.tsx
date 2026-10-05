import { ArrowRight, CircleCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Benefit } from '../lib/api'
import { cn } from '../lib/cn'
import { useReducedMotion } from '../lib/motion'
import { Link } from './Link'

const COUNT_MS = 450

/** Counts up from 0 the first time a number arrives (ease-out), then shows changes straight away. */
function useCountUp(value: number | null) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState<number | null>(reduced ? value : null)
  const [done, setDone] = useState(reduced)
  useEffect(() => {
    if (value == null || done) return
    let raf = 0
    const t0 = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / COUNT_MS)
      setShown(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
      else setDone(true)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, done])
  if (value == null) return null
  return done ? value : (shown ?? 0)
}

/** The number, counting up for sighted users; screen readers get the final number, not each step. */
function Count({ value, className }: { value: number | null; className?: string }) {
  const shown = useCountUp(value)
  return (
    <span className={cn('font-extrabold tracking-[-0.04em] tabular-nums', className)}>
      <span aria-hidden>{shown ?? '–'}</span>
      <span className="sr-only">{value ?? 'Loading'}</span>
    </span>
  )
}

const RING_R = 40
const RING_LEN = 2 * Math.PI * RING_R

/** The share of tracked benefits expiring soon, as a ring with the count inside. */
function ExpiryRing({ count, tracked }: { count: number | null; tracked: number | null }) {
  const share = count && tracked ? count / tracked : 0
  return (
    <div className="relative grid size-[72px] shrink-0 place-items-center">
      <svg viewBox="0 0 96 96" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="48" cy="48" r={RING_R} fill="none" stroke="rgb(255 255 255 / 0.22)" strokeWidth="10" />
        <circle
          cx="48"
          cy="48"
          r={RING_R}
          fill="none"
          stroke="#FDE68A"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${share * RING_LEN} ${RING_LEN}`}
          className="transition-[stroke-dasharray] duration-500 ease-out"
        />
      </svg>
      <Count value={count} className="relative text-[30px] leading-none" />
    </div>
  )
}

const dayWords = (days: number) => (days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`)

interface KpiRowProps {
  tracked: number | null
  /** Tracked benefits expiring in the next 30 days, soonest first. */
  soon: Benefit[] | null
  needsReview: number | null
}

/** The dashboard's three numbers as compact tiles (the Bento design): expiring, tracked and waiting for review. */
export function KpiRow({ tracked, soon, needsReview }: KpiRowProps) {
  const expiring = soon?.length ?? null
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr]" aria-live="polite">
      <Link
        href="/benefits?status=soon"
        style={{ animationDelay: '0ms' }}
        className="flex animate-rise items-center gap-4 rounded-[22px] bg-linear-140 from-[#C2410C] to-[#9A3412] px-5 py-4 text-white shadow-[0_24px_60px_-28px_rgb(194_65_12/0.8)] transition-transform duration-150 hover:-translate-y-0.5 sm:col-span-2 lg:col-span-1"
      >
        <ExpiryRing count={expiring} tracked={tracked} />
        <div className="grid min-w-0 gap-2">
          <p className="font-bold">
            Expiring in 30 days
            {tracked ? <span className="font-medium text-[#FFEDD5]"> · of {tracked} tracked</span> : null}
          </p>
          {soon && soon.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="Soonest">
              {soon.slice(0, 3).map((b) => (
                <li
                  key={b.id}
                  className="max-w-full truncate rounded-full bg-white/18 px-2.5 py-0.5 text-xs font-bold"
                >
                  {b.provider || b.benefit_name} · {dayWords(b.days_until_expiry ?? 0)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#FFEDD5]">{soon ? 'Nothing runs out this month.' : ' '}</p>
          )}
        </div>
      </Link>

      <Link
        href="/benefits"
        style={{ animationDelay: '40ms' }}
        className="glass flex animate-rise items-center gap-3.5 rounded-[22px] px-5 py-4 transition-transform duration-150 hover:-translate-y-0.5"
      >
        <Count value={tracked} className="text-[44px] leading-none" />
        <span className="grid">
          <span className="font-bold">Tracked</span>
          <span className="text-sm text-ink-muted">benefits, cards and points</span>
        </span>
      </Link>

      {needsReview ? (
        // A plain link: the review queue is further down this page.
        <a
          href="#review"
          style={{ animationDelay: '80ms' }}
          className="flex animate-rise items-center gap-3.5 rounded-[22px] bg-[#FCD34D] px-5 py-4 text-[#1C1917] transition-transform duration-150 hover:-translate-y-0.5"
        >
          <Count value={needsReview} className="text-[44px] leading-none" />
          <span className="grid flex-1">
            <span className="font-bold">To review</span>
            <span className="text-sm font-medium">Found in your email</span>
          </span>
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1C1917] text-[#FCD34D]">
            <ArrowRight className="size-[18px]" strokeWidth={2.4} />
          </span>
        </a>
      ) : (
        <div
          style={{ animationDelay: '80ms' }}
          className="glass flex animate-rise items-center gap-3.5 rounded-[22px] px-5 py-4"
        >
          {needsReview === 0 ? (
            <CircleCheck className="size-10 shrink-0 text-ok" aria-hidden />
          ) : (
            <Count value={null} className="text-[44px] leading-none" />
          )}
          <span className="grid">
            <span className="font-bold">{needsReview === 0 ? 'All reviewed' : 'To review'}</span>
            <span className="text-sm text-ink-muted">Every date checked</span>
          </span>
        </div>
      )}
    </div>
  )
}
