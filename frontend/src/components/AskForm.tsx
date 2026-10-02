import { MessageCircle, Send } from 'lucide-react'
import { useState, type FormEvent, type Ref } from 'react'
import { api, errorMessage, type AskEntry } from '../lib/api'
import { cn } from '../lib/cn'
import { Button } from './ui/Button'
import { Kbd } from './ui/Kbd'
import { Card, CardHeader } from './ui/Card'
import { Message } from './ui/Message'
import { Skeleton } from './ui/Skeleton'

interface AskFormProps {
  inputRef: Ref<HTMLInputElement>
  /** Called with each answered question; the page shows it in the history. */
  onAsked: (entry: AskEntry) => void
}

export function AskForm({ inputRef, onAsked }: AskFormProps) {
  const [question, setQuestion] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!question.trim()) {
      setFieldError('Type a question first.')
      e.currentTarget.querySelector('input')?.focus()
      return
    }
    setFieldError(null)
    setError(null)
    setLoading(true)
    try {
      onAsked(await api.ask(question))
      setQuestion('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card as="section" id="ask" aria-labelledby="ask-title">
      <CardHeader icon={MessageCircle} title="Ask about your benefits" titleId="ask-title" action={<Kbd>/</Kbd>} />
      <form className="grid gap-4 p-5" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-1.5">
          <label htmlFor="question" className="text-sm font-semibold">
            Question
          </label>
          <input
            id="question"
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            autoComplete="off"
            enterKeyHint="send"
            aria-invalid={fieldError ? true : undefined}
            aria-describedby={fieldError ? 'question-error' : 'question-hint'}
            placeholder="Which travel perks should I use before March?"
            className={cn(
              'min-h-11 w-full rounded-xl border bg-surface px-3 transition-colors duration-150 hover:border-ink-muted/50 focus:border-primary',
              fieldError ? 'border-danger' : 'border-line',
            )}
          />
          {fieldError ? (
            <p id="question-error" role="alert" className="text-sm font-medium text-danger">
              {fieldError}
            </p>
          ) : (
            <p id="question-hint" className="text-xs text-ink-muted">
              Answers use only the benefits you’re tracking, not outside knowledge.
            </p>
          )}
        </div>

        <div>
          <Button type="submit" variant="primary" icon={<Send className="size-4" aria-hidden />} loading={loading} loadingLabel="Thinking…">
            Ask
          </Button>
        </div>

        <div aria-live="polite" className="grid gap-2">
          {loading ? (
            <>
              <Skeleton />
              <Skeleton className="w-2/3" />
            </>
          ) : error ? (
            <Message tone="error">{error}</Message>
          ) : null}
        </div>
      </form>
    </Card>
  )
}
