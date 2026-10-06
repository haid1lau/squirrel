import { ArrowRight } from 'lucide-react'
import type { ScanStatus } from '../lib/api'
import { DiggingSquirrel } from './DiggingSquirrel'
import { Link } from './Link'
import { Message } from './ui/Message'

export const SCAN_POLL_MS = 1500

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

// Matches SEARCH_LIMIT and SEARCH_DAYS in scan_jobs.py.
const LIMIT_NOTE =
  'Squirrel checks only your newest 200 benefit emails from the past 6 months, and it has read them all.'
// Matches DAILY_EMAIL_CAP in scan_jobs.py.
const DAILY_NOTE = 'That’s the most Squirrel reads in a day (100 emails). Scan again tomorrow to continue.'

function scanSummary(s: ScanStatus) {
  const parts = [
    `${plural(s.added ?? 0, 'benefit')} added`,
    `${s.needs_review ?? 0} to review`,
    `${plural(s.skipped ?? 0, 'email')} weren’t benefits`,
  ]
  if (s.filtered) parts.push(`${plural(s.filtered, 'marketing email')} skipped`)
  if (s.failed) parts.push(`${plural(s.failed, 'email')} couldn’t be read (tried again next scan, up to 3 times)`)
  if (!s.checked) {
    if (s.daily_limit_reached) return DAILY_NOTE
    return s.limit_reached ? LIMIT_NOTE : 'No new benefit emails found.'
  }
  let text = `Checked ${plural(s.checked, 'email')}: ${parts.join(', ')}.`
  if (s.daily_limit_reached) text += ` ${DAILY_NOTE}`
  else if (s.remaining) text += ` ${plural(s.remaining, 'older email')} still to check — scan again to continue.`
  if (s.limit_reached) text += ` ${LIMIT_NOTE}`
  return text
}

/** While an inbox scan runs: the squirrel digging, a progress line and a bar. */
export function ScanProgress({ scan }: { scan: ScanStatus }) {
  if (scan.state !== 'running') return null
  const progress = scan.total ? Math.round(((scan.checked ?? 0) / scan.total) * 100) : null
  return (
    <div className="flex animate-rise items-center gap-3 rounded-xl bg-surface-2 p-3">
      <DiggingSquirrel className="size-14" />
      <div className="grid min-w-0 flex-1 gap-1.5">
        <p className="text-sm font-semibold" aria-live="polite">
          {scan.total == null
            ? 'Searching your inbox…'
            : `Checked ${scan.checked ?? 0} of ${plural(scan.total, 'email')}…`}
        </p>
        <div
          role="progressbar"
          aria-label="Scan progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress ?? undefined}
          className="h-1.5 overflow-hidden rounded-full bg-line"
        >
          <div
            className="h-full rounded-full bg-cta transition-[width] duration-300"
            style={{ width: `${progress ?? 5}%` }}
          />
        </div>
      </div>
    </div>
  )
}

/** "Found 3 new benefits", with links to where they went, then the details. */
function ScanFound({ scan }: { scan: ScanStatus }) {
  const added = scan.added ?? 0
  const review = scan.needs_review ?? 0
  const found = added + review
  const linkClass =
    'inline-flex min-h-11 items-center gap-1.5 font-semibold text-primary-text underline-offset-4 hover:underline'
  return (
    <div className="grid animate-rise gap-1 rounded-xl bg-ok-soft p-3 text-sm">
      <p className="text-base font-semibold text-ink">
        {found
          ? `Found ${plural(found, 'new benefit')}`
          : scan.limit_reached || scan.daily_limit_reached
            ? 'Scan limit reached'
            : 'No new benefits this time'}
      </p>
      <p className="text-ink-muted">{scanSummary(scan)}</p>
      {found ? (
        <div className="flex flex-wrap gap-x-5">
          {review ? (
            <Link href="/#review" className={linkClass}>
              Review {review === 1 ? 'it' : `${review}`} in the review queue
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
          {added ? (
            <Link href="/benefits" className={linkClass}>
              See {added === 1 ? 'it' : 'them'} in All Benefits
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** What the last scan found, or why it stopped. */
export function ScanResult({ scan }: { scan: ScanStatus }) {
  // Memberships are found before the AI step, so report them even if that step failed.
  const memberships =
    scan.state !== 'running' && scan.memberships ? (
      <Message tone="success">
        Found {plural(scan.memberships, 'loyalty membership')} from who emails you. Confirm{' '}
        {scan.memberships === 1 ? 'it' : 'them'} in the review queue.
      </Message>
    ) : null
  return (
    <>
      {memberships}
      {scan.state === 'done' ? <ScanFound scan={scan} /> : null}
      {scan.state === 'error' && scan.message ? <Message tone="error">{scan.message}</Message> : null}
    </>
  )
}
