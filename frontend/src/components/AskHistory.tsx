import { History, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useArmedAction } from '../hooks/useArmedAction'
import { api, errorMessage, type AskEntry, type Benefit } from '../lib/api'
import { isArchived } from '../lib/usage'
import { useToast } from '../lib/toast'
import { AiLabel } from './AiLabel'
import { CategoryArt } from './CategoryArt'
import { Link } from './Link'
import { UrgencyBadge } from './UrgencyBadge'
import { Button } from './ui/Button'
import { Card, CardHeader, CountChip } from './ui/Card'
import { Message } from './ui/Message'
import { Skeleton } from './ui/Skeleton'

const timeFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/**
 * The answer in pieces (its lines, or its sentences if it's one paragraph), so a
 * new answer can appear one piece at a time. Only the look is staggered: the
 * whole text is in the page at once for screen readers.
 */
function RevealedAnswer({ text }: { text: string }) {
  const lines = text.split('\n')
  const pieces = lines.length > 1 ? lines : text.split(/(?<=[.!?])\s+/)
  const join = lines.length > 1 ? '\n' : ' '
  return (
    <>
      {pieces.map((piece, i) => (
        // Fixed for a given answer, so the index is a safe key.
        <span key={i} className="animate-rise" style={{ animationDelay: `${i * 180}ms` }}>
          {piece}
          {i < pieces.length - 1 ? join : null}
        </span>
      ))}
    </>
  )
}

/** Tracked benefits an answer names (up to 3), shown as cards under it. */
function mentioned(answer: string, benefits: Benefit[]) {
  const text = answer.toLowerCase()
  return benefits
    .filter((b) => !isArchived(b) && b.benefit_name.length >= 4 && text.includes(b.benefit_name.toLowerCase()))
    .slice(0, 3)
}

function MentionedCard({ benefit }: { benefit: Benefit }) {
  return (
    <Link
      href={`/benefits#benefit-${benefit.id}`}
      className="glass flex items-center gap-3 rounded-2xl p-3 transition-transform duration-150 hover:-translate-y-0.5"
    >
      <CategoryArt category={benefit.category} className="size-11" />
      <span className="grid min-w-0 flex-1">
        <span className="truncate font-bold">{benefit.benefit_name}</span>
        <span className="truncate text-sm text-ink-muted">{benefit.provider}</span>
      </span>
      {benefit.needs_review ? (
        <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-warn">
          Needs review
        </span>
      ) : (
        <UrgencyBadge days={benefit.days_until_expiry} />
      )}
    </Link>
  )
}

interface AskHistoryProps {
  /** Tracked benefits, to show the ones an answer names. */
  benefits: Benefit[] | null
  entries: AskEntry[] | null
  /** The answer just asked for, which appears line by line. */
  freshId?: string | null
  error: string | null
  onRetry: () => void
  onCleared: () => void
}

export function AskHistory({ benefits, entries, freshId, error, onRetry, onCleared }: AskHistoryProps) {
  const toast = useToast()
  const [armed, click, reset] = useArmedAction()
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)

  async function clear() {
    if (!click()) return
    setClearing(true)
    setClearError(null)
    try {
      await api.clearAskHistory()
      onCleared()
      toast('info', 'Question history cleared.')
    } catch (e) {
      setClearError(errorMessage(e))
      reset()
    } finally {
      setClearing(false)
    }
  }

  return (
    <Card as="section" aria-labelledby="history-title">
      <CardHeader
        icon={History}
        title="Conversation"
        titleId="history-title"
        action={entries?.length ? <CountChip>{entries.length}</CountChip> : null}
      />
      <div className="grid gap-4 p-5">
        {error ? (
          <div className="grid gap-3">
            <Message tone="error">Couldn’t load your past questions: {error}</Message>
            <div>
              <Button icon={<RefreshCw className="size-4" aria-hidden />} onClick={onRetry}>
                Try again
              </Button>
            </div>
          </div>
        ) : !entries ? (
          <div aria-busy="true" aria-label="Loading past questions" className="grid gap-2">
            <Skeleton className="w-1/2" />
            <Skeleton />
            <Skeleton className="w-2/3" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-4 text-center text-ink-muted">Questions you ask appear here, newest first.</p>
        ) : (
          <>
            <ol className="grid gap-4" aria-live="polite">
              {entries.map((entry) => {
                const cards = benefits ? mentioned(entry.answer, benefits) : []
                return (
                  <li key={entry.id} className="grid animate-rise gap-3 border-b border-line pb-5 last:border-b-0 last:pb-0">
                    <div className="grid max-w-[85%] justify-items-end gap-1 justify-self-end">
                      <p className="rounded-[20px_20px_4px_20px] bg-ink px-4 py-2.5 font-semibold text-bg">{entry.question}</p>
                      <time dateTime={entry.created_at} className="text-xs text-ink-muted">
                        {timeFormat.format(new Date(entry.created_at))}
                      </time>
                    </div>
                    <div className="grid max-w-[92%] gap-2">
                      <div>
                        <AiLabel />
                      </div>
                      <p className="rounded-[20px_20px_20px_4px] bg-surface-2 px-4 py-3 whitespace-pre-wrap">
                        {entry.id === freshId ? <RevealedAnswer text={entry.answer} /> : entry.answer}
                      </p>
                      {cards.length ? (
                        <ul className="grid max-w-xl gap-2" aria-label="Benefits in this answer">
                          {cards.map((b) => (
                            <li key={b.id}>
                              <MentionedCard benefit={b} />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
            <div>
              <Button
                variant="danger"
                icon={<Trash2 className="size-4" aria-hidden />}
                loading={clearing}
                loadingLabel="Clearing…"
                onClick={clear}
                className={armed ? 'border-danger bg-danger-soft' : undefined}
              >
                {armed ? 'Click again to clear' : 'Clear history'}
              </Button>
            </div>
          </>
        )}
        {clearError ? <Message tone="error">{clearError}</Message> : null}
      </div>
    </Card>
  )
}
