import { MailCheck } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { api, errorMessage, type User } from '../lib/api'
import { cn } from '../lib/cn'
import { fieldClass } from '../lib/styles'
import { useToast } from '../lib/toast'
import { Button } from './ui/Button'

/**
 * Shown until the user confirms their address. Squirrel works meanwhile; only
 * reminder emails wait. Resends the link, or fixes a mistyped address.
 */
export function VerifyEmailBanner({ user, onUserChange }: { user: User; onUserChange: () => void }) {
  const id = useId()
  const toast = useToast()
  const [sending, setSending] = useState(false)
  const [changing, setChanging] = useState(false)
  const [address, setAddress] = useState(user.email)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resend() {
    setSending(true)
    try {
      const { email_enabled } = await api.resendVerification()
      toast(
        email_enabled ? 'success' : 'info',
        email_enabled
          ? `Sent a new link to ${user.email}.`
          : 'Email isn’t set up on this server, so the link was printed in the server terminal.',
      )
    } catch (e) {
      toast('error', errorMessage(e))
    } finally {
      setSending(false)
    }
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const { user: changed } = await api.changeEmail(address)
      toast('success', `Sent a link to ${changed.email}.`)
      setChanging(false)
      onUserChange()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 sm:px-5"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <MailCheck className="size-5 shrink-0 text-warn" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          <strong id={`${id}-title`}>Confirm your email to get expiry reminders.</strong>{' '}
          <span className="text-ink-muted">
            We sent a link to <span className="[overflow-wrap:anywhere]">{user.email}</span>. Not there? Check your spam
            and Promotions folders.
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={resend} loading={sending} loadingLabel="Sending…">
            Resend
          </Button>
          {user.has_password && !changing ? <Button onClick={() => setChanging(true)}>Wrong address?</Button> : null}
        </div>
      </div>
      {changing ? (
        <form onSubmit={save} noValidate className="flex flex-wrap items-start gap-2">
          <label htmlFor={`${id}-email`} className="sr-only">
            Your email address
          </label>
          <div className="min-w-0 flex-1 basis-60">
            <input
              id={`${id}-email`}
              type="email"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="email"
              autoFocus
              className={cn(fieldClass, error ? 'border-danger' : 'border-line')}
            />
          </div>
          <Button type="submit" variant="primary" loading={saving} loadingLabel="Saving…">
            Save and send link
          </Button>
          <Button onClick={() => setChanging(false)}>Cancel</Button>
          {error ? (
            <p role="alert" className="basis-full text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  )
}
