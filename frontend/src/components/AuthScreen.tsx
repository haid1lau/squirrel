import { ArrowLeft, KeyRound, LogIn, Mail, Send, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { api, errorMessage, googleUrl } from '../lib/api'
import { cn } from '../lib/cn'
import { fieldClass } from '../lib/styles'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Message } from './ui/Message'

type Mode = 'signin' | 'register' | 'forgot'

interface AuthScreenProps {
  googleEnabled: boolean
  initialError: string | null
  onSignedIn: () => void
}

/** Asks for an email address and sends a reset link to it. */
function ForgotPasswordForm({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState<{
    email: string
    emailEnabled: boolean
  } | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Enter the email address you sign in with.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const res = await api.forgotPassword(email)
      setSent({ email: email.trim(), emailEnabled: res.email_enabled })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit} noValidate aria-label="Reset your password">
      <p className="text-sm text-ink-muted">
        Enter the email you sign in with. We’ll send a link to choose a new password.
      </p>
      <div className="grid gap-1.5">
        <label htmlFor="forgot-email" className="text-sm font-semibold">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={cn(fieldClass, 'border-line')}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        icon={<Send className="size-4" aria-hidden />}
        loading={loading}
        loadingLabel="Sending…"
      >
        {sent ? 'Send another link' : 'Send reset link'}
      </Button>
      <div aria-live="polite" className="grid gap-2">
        {sent ? (
          <Message tone="success">
            If there’s a Squirrel account for {sent.email}, a reset link is on its way. It works once, for 1 hour.
          </Message>
        ) : null}
        {sent && !sent.emailEnabled ? (
          <Message tone="info">
            Email sending isn’t set up on this server yet, so the link was printed in the server’s terminal instead.
          </Message>
        ) : null}
        {error ? <Message tone="error">{error}</Message> : null}
      </div>
      <div>
        <Button icon={<ArrowLeft className="size-4" aria-hidden />} onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    </form>
  )
}

export function AuthScreen({ googleEnabled, initialError, onSignedIn }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [loading, setLoading] = useState(false)

  const registering = mode === 'register'
  const forgot = mode === 'forgot'

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await (registering ? api.register(email, password, name) : api.login(email, password))
      onSignedIn()
    } catch (err) {
      setError(errorMessage(err))
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 py-10">
      <div className="grid justify-items-center gap-3 text-center">
        <img src="/icon-192.png" alt="" width={48} height={48} className="size-12" />
        <h1 className="text-2xl font-bold tracking-tight">
          {forgot ? 'Reset your password' : registering ? 'Create your Squirrel account' : 'Sign in to Squirrel'}
        </h1>
        {forgot ? null : (
          <p className="text-ink-muted">
            Connect your Gmail and cards, and never let a voucher, membership or card credit expire unnoticed.
          </p>
        )}
      </div>

      <Card className="grid gap-5 p-6">
        {forgot ? (
          <ForgotPasswordForm
            initialEmail={email}
            onBack={() => {
              setMode('signin')
              setError(null)
            }}
          />
        ) : (
          <>
            <div role="group" aria-label="Account" className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
              {(['signin', 'register'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => {
                    setMode(m)
                    setError(null)
                  }}
                  className={cn(
                    'min-h-11 cursor-pointer rounded-lg text-sm font-semibold transition-colors duration-150',
                    mode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {m === 'signin' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <div className="grid gap-2">
              <Button
                icon={<Mail className="size-4" aria-hidden />}
                onClick={() => window.location.assign(googleUrl('login'))}
                disabled={!googleEnabled}
                className="w-full disabled:cursor-not-allowed disabled:opacity-60"
                aria-describedby="google-hint"
              >
                Continue with Google
              </Button>
              <p id="google-hint" className="text-xs text-ink-muted">
                {googleEnabled
                  ? 'Also connects your Gmail (read-only) so Squirrel can find benefit emails. You can untick that on Google’s screen.'
                  : 'Google sign-in isn’t set up on this server yet. Use an email and password for now.'}
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs font-semibold text-ink-muted uppercase" aria-hidden>
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <form className="grid gap-4" onSubmit={handleSubmit} noValidate>
              {registering ? (
                <div className="grid gap-1.5">
                  <label htmlFor="auth-name" className="text-sm font-semibold">
                    Name <span className="font-normal text-ink-muted">(optional)</span>
                  </label>
                  <input
                    id="auth-name"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(fieldClass, 'border-line')}
                  />
                </div>
              ) : null}

              <div className="grid gap-1.5">
                <label htmlFor="auth-email" className="text-sm font-semibold">
                  Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(fieldClass, 'border-line')}
                />
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="auth-password" className="text-sm font-semibold">
                    Password
                  </label>
                  {registering ? null : (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot')
                        setError(null)
                      }}
                      className="-my-2.5 inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg text-sm font-semibold text-primary-text underline-offset-4 hover:underline"
                    >
                      <KeyRound className="size-3.5" aria-hidden />
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={registering ? 'new-password' : 'current-password'}
                  required
                  minLength={registering ? 10 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={registering ? 'auth-password-hint' : undefined}
                  className={cn(fieldClass, 'border-line')}
                />
                {registering ? (
                  <p id="auth-password-hint" className="text-xs text-ink-muted">
                    At least 10 characters.
                  </p>
                ) : null}
              </div>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                icon={
                  registering ? <UserPlus className="size-4" aria-hidden /> : <LogIn className="size-4" aria-hidden />
                }
                loading={loading}
                loadingLabel={registering ? 'Creating account…' : 'Signing in…'}
              >
                {registering ? 'Create account' : 'Sign in'}
              </Button>

              <div aria-live="polite">{error ? <Message tone="error">{error}</Message> : null}</div>
            </form>
          </>
        )}
      </Card>

      <p className="text-center text-xs text-ink-muted">Squirrel never asks for card numbers or bank logins.</p>
    </main>
  )
}
