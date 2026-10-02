import { useCallback, useEffect, useRef, useState } from 'react'
import { AskForm } from '../components/AskForm'
import { AskHistory } from '../components/AskHistory'
import { DigestCard } from '../components/DigestCard'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { api, errorMessage, type AskEntry } from '../lib/api'

export function AssistantPage() {
  const questionRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<AskEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

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
        <h1 tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none sm:text-3xl">
          Assistant
        </h1>
        <p className="mt-1 text-ink-muted">
          Ask about your benefits, or get a ranked digest of what needs attention. Answers come only from what you track.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="grid gap-6 lg:col-span-2">
          <AskForm inputRef={questionRef} onAsked={(entry) => setHistory((h) => [entry, ...(h ?? [])])} />
          <AskHistory entries={history} error={error} onRetry={retry} onCleared={() => setHistory([])} />
        </div>
        <DigestCard />
      </div>
    </div>
  )
}
