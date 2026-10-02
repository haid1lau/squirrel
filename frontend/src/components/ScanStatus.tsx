import type { ScanStatus } from '../lib/api'
import { Message } from './ui/Message'

export const SCAN_POLL_MS = 1500

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

function scanSummary(s: ScanStatus) {
  const parts = [
    `${plural(s.added ?? 0, 'benefit')} added`,
    `${s.needs_review ?? 0} to review`,
    `${plural(s.skipped ?? 0, 'email')} weren’t benefits`,
  ]
  if (s.failed) parts.push(`${plural(s.failed, 'email')} couldn’t be read (retried next scan)`)
  let text = s.checked ? `Checked ${plural(s.checked, 'email')}: ${parts.join(', ')}.` : 'No new benefit emails found.'
  if (s.remaining) text += ` ${plural(s.remaining, 'older email')} still to check — scan again to continue.`
  return text
}

/** Progress bar while an inbox scan runs. */
export function ScanProgress({ scan }: { scan: ScanStatus }) {
  if (scan.state !== 'running') return null
  const progress = scan.total ? Math.round(((scan.checked ?? 0) / scan.total) * 100) : null
  return (
    <div className="grid gap-1.5">
      <p className="text-sm text-ink-muted" aria-live="polite">
        {scan.total == null
          ? 'Searching your inbox…'
          : `Read ${scan.checked ?? 0} of ${plural(scan.total, 'email')}…`}
      </p>
      <div
        role="progressbar"
        aria-label="Scan progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress ?? undefined}
        className="h-1.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${progress ?? 5}%` }}
        />
      </div>
    </div>
  )
}

/** What the last scan found, or why it stopped. */
export function ScanResult({ scan }: { scan: ScanStatus }) {
  // Memberships are found before the AI step, so report them even if that step failed.
  const memberships = scan.state !== 'running' && scan.memberships ? (
    <Message tone="success">
      Found {plural(scan.memberships, 'loyalty membership')} from who emails you. Confirm{' '}
      {scan.memberships === 1 ? 'it' : 'them'} in the review queue.
    </Message>
  ) : null
  return (
    <>
      {memberships}
      {scan.state === 'done' ? <Message tone="success">{scanSummary(scan)}</Message> : null}
      {scan.state === 'error' && scan.message ? <Message tone="error">{scan.message}</Message> : null}
    </>
  )
}
