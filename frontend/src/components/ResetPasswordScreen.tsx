import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, errorMessage } from '../lib/api'
import { cn } from '../lib/cn'
import { navigate } from '../lib/router'
import { fieldClass } from '../lib/styles'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Link } from './Link'
import { Message } from './ui/Message'

/** Reads the token from the emailed link (#token=...), then removes it from the address bar. */
function takeToken() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  return token
}

/** Opened from the reset email: choose a new password, then go to the dashboard signed in. */
export function ResetPasswordScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [token] = useState(takeToken)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (password.length < 10) {
      setError('Use a password of at least 10 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await api.resetPassword(token ?? '', password)
      navigate('/')
      onSignedIn()
    } catch (err) {
      setError(errorMessage(err))
      setLoading(false)
    }
  }

  const input = cn(fieldClass, 'border-line')

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 py-10">
      <div className="grid justify-items-center gap-3 text-center">
        <img src="/icon-192.png" alt="" width={48} height={48} className="size-12" />
        <h1 className="text-2xl font-bold tracking-tight">Choose a new password</h1>
      </div>

      <Card className="grid gap-5 p-6">
        {token ? (
          <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-1.5">
              <label htmlFor="reset-password" className="text-sm font-semibold">
                New password
              </label>
              <input
                id="reset-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="reset-password-hint"
                className={input}
              />
              <p id="reset-password-hint" className="text-xs text-ink-muted">
                At least 10 characters. You’ll be signed out everywhere else.
              </p>
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="reset-confirm" className="text-sm font-semibold">
                Type it again
              </label>
              <input
                id="reset-confirm"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={input}
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              className="w-full"
              icon={<KeyRound className="size-4" aria-hidden />}
              loading={loading}
              loadingLabel="Saving…"
            >
              Save new password
            </Button>
            <div aria-live="polite">{error ? <Message tone="error">{error}</Message> : null}</div>
          </form>
        ) : (
          <Message tone="error">
            This link is incomplete. Open the link from the email again, or ask for a new one from the sign-in page.
          </Message>
        )}
        <Link href="/" className="inline-flex min-h-11 items-center justify-self-start rounded-lg text-sm font-semibold text-primary-text underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </Card>
    </main>
  )
}
