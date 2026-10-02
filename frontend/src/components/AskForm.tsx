import { MessageCircle, Send } from 'lucide-react'
import { useState, type FormEvent, type Ref } from 'react'
import { api, errorMessage, type AskEntry } from '../lib/api'
import { cn } from '../lib/cn'
import { Button } from './ui/Button'
import { Kbd } from './ui/Kbd'
import { Card, CardHeader } from './ui/Card'
import { Message } from './ui/Message'

interface AskFormProps {
  inputRef: Ref<HTMLInputElement>
  /** Called with each answered question; the page shows it in the history. */
  onAsked: (entry: AskEntry) => void
}

/** "Squirrel is thinking" with three bouncing dots, while an answer is on its way. */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 justify-self-start rounded-xl bg-surface-2 px-4 py-3">
      <span className="text-sm text-ink-muted">Squirrel is thinking</span>
      <span aria-hidden className="flex gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-2 animate-typing rounded-full bg-ink-muted"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </div>
  )
}

export function AskForm({ inputRef, onAsked }: AskFormProps) {
  const [question, setQuestion] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [asked, setAsked] = useState('')

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
    setAsked(question.trim())
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
            <div className="grid animate-rise gap-2">
              <p className="justify-self-end rounded-xl bg-primary-soft px-4 py-2 font-semibold">{asked}</p>
              <TypingIndicator />
            </div>
          ) : error ? (
            <Message tone="error">{error}</Message>
          ) : null}
        </div>
      </form>
    </Card>
  )
}
