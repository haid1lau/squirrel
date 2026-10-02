import { History, RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useArmedAction } from '../hooks/useArmedAction'
import { api, errorMessage, type AskEntry } from '../lib/api'
import { useToast } from '../lib/toast'
import { AiLabel } from './AiLabel'
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

interface AskHistoryProps {
  entries: AskEntry[] | null
  /** The answer just asked for, which appears line by line. */
  freshId?: string | null
  error: string | null
  onRetry: () => void
  onCleared: () => void
}

export function AskHistory({ entries, freshId, error, onRetry, onCleared }: AskHistoryProps) {
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
        title="Past questions"
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
              {entries.map((entry) => (
                <li key={entry.id} className="grid animate-rise gap-2 border-b border-line pb-4 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-semibold">{entry.question}</p>
                    <time dateTime={entry.created_at} className="text-xs text-ink-muted">
                      {timeFormat.format(new Date(entry.created_at))}
                    </time>
                  </div>
                  <div>
                    <AiLabel />
                  </div>
                  <p className="rounded-xl bg-surface-2 px-4 py-3 whitespace-pre-wrap">
                    {entry.id === freshId ? <RevealedAnswer text={entry.answer} /> : entry.answer}
                  </p>
                </li>
              ))}
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
