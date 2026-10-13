import { CalendarClock } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AskForm } from '../components/AskForm'
import { AskHistory } from '../components/AskHistory'
import { DigestCard } from '../components/DigestCard'
import { Link } from '../components/Link'
import { UrgencyBadge } from '../components/UrgencyBadge'
import { Card, CardHeader } from '../components/ui/Card'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { api, errorMessage, type AskEntry, type Benefit } from '../lib/api'
import { isArchived } from '../lib/usage'

/** The next few things to run out, beside the conversation, for context while asking. */
function ExpiringSoon({ benefits }: { benefits: Benefit[] | null }) {
  const soon = useMemo(
    () =>
      benefits
        ?.filter((b) => !b.needs_review && !isArchived(b) && !b.used_on && b.days_until_expiry != null)
        .toSorted((a, b) => (a.days_until_expiry ?? 0) - (b.days_until_expiry ?? 0))
        .slice(0, 5) ?? [],
    [benefits],
  )
  if (!soon.length) return null
  return (
    <Card as="section" aria-labelledby="soon-title">
      <CardHeader icon={CalendarClock} title="Expiring soon" titleId="soon-title" />
      <ul className="divide-y divide-line px-5">
        {soon.map((b) => (
          <li key={b.id}>
            <Link
              href={`/benefits#benefit-${b.id}`}
              className="flex min-h-11 items-center justify-between gap-3 py-3 hover:text-primary-text"
            >
              <span className="grid min-w-0">
                <span className="truncate text-sm font-bold">{b.benefit_name}</span>
                <span className="truncate text-xs text-ink-muted">{b.provider}</span>
              </span>
              <UrgencyBadge days={b.days_until_expiry} />
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-line px-5 py-3">
        <Link href="/benefits" className="text-sm font-semibold text-primary-text underline-offset-4 hover:underline">
          See all benefits
        </Link>
      </div>
    </Card>
  )
}

export function AssistantPage({ benefits }: { benefits: Benefit[] | null }) {
  const questionRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<AskEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [freshId, setFreshId] = useState<string | null>(null)

  useKeyboardShortcuts({ '/': () => questionRef.current?.focus() })

  useEffect(() => {
    const controller = new AbortController()
    api.askHistory(controller.signal).then(
      (entries) => {
        setHistory(entries)
        setError(null)
      },
      (e) => {
        if (!controller.signal.aborted) setError(errorMessage(e))
      },
    )
    return () => controller.abort()
  }, [attempt])

  const retry = useCallback(() => {
    setError(null)
    setAttempt((n) => n + 1)
  }, [])

  return (
    <div className="grid gap-6">
      <div>
        <h1 tabIndex={-1} className="text-3xl font-extrabold tracking-[-0.03em] outline-none sm:text-[40px] sm:leading-tight">
          Assistant
        </h1>
        <p className="mt-1 text-ink-muted">
          Ask about your benefits, or get a ranked digest of what needs attention. Answers come only from what you track.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-6">
          <AskForm
            inputRef={questionRef}
            onAsked={(entry) => {
              setFreshId(entry.id)
              setHistory((h) => [entry, ...(h ?? [])])
            }}
          />
          <AskHistory
            benefits={benefits}
            entries={history}
            freshId={freshId}
            error={error}
            onRetry={retry}
            onCleared={() => setHistory([])}
          />
        </div>
        <div className="grid gap-6">
          <ExpiringSoon benefits={benefits} />
          <DigestCard />
        </div>
      </div>
    </div>
  )
}
