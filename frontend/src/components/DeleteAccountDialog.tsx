import { Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { api, errorMessage, type User } from '../lib/api'
import { cn } from '../lib/cn'
import { fieldClass } from '../lib/styles'
import { Button } from './ui/Button'
import { Message } from './ui/Message'

interface DeleteAccountDialogProps {
  user: User
  onClose: () => void
  /** Called once the account is gone; the page should go back to the signed-out view. */
  onDeleted: () => void
}

/**
 * Deletes the account and everything Squirrel holds for it, after the user
 * confirms with their password (or, for Google-only accounts, their email).
 * A native <dialog>: it traps focus and closes on Escape by itself.
 */
export function DeleteAccountDialog({ user, onClose, onDeleted }: DeleteAccountDialogProps) {
  const id = useId()
  const ref = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ref.current?.showModal()
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!value.trim()) {
      setError(user.has_password ? 'Enter your password.' : 'Type your email address.')
      return
    }
    setError(null)
    setDeleting(true)
    try {
      await api.deleteAccount(user.has_password ? { password: value } : { email: value })
      onDeleted()
    } catch (err) {
      setError(errorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-popover p-0 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={handleSubmit} noValidate className="grid gap-4 p-6">
        <h2 id={`${id}-title`} className="text-xl font-bold tracking-tight">
          Delete your account?
        </h2>
        <div className="grid gap-2 text-sm text-ink-muted">
          <p>This permanently deletes everything Squirrel holds for {user.email}:</p>
          <ul className="grid list-disc gap-1 pl-5">
            <li>your benefits, cards, reminders and assistant history</li>
            <li>your email connections. Gmail access is revoked at Google; app passwords are deleted.</li>
          </ul>
          <p>It can’t be undone.</p>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-confirm`} className="text-sm font-semibold">
            {user.has_password ? 'Your password' : `Type ${user.email} to confirm`}
          </label>
          <input
            id={`${id}-confirm`}
            type={user.has_password ? 'password' : 'email'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete={user.has_password ? 'current-password' : 'off'}
            autoFocus
            className={cn(fieldClass, error ? 'border-danger' : 'border-line')}
          />
        </div>
        {error ? <Message tone="error">{error}</Message> : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="danger"
            icon={<Trash2 className="size-4" aria-hidden />}
            loading={deleting}
            loadingLabel="Deleting…"
            className="border-danger"
          >
            Delete my account
          </Button>
          <Button icon={<X className="size-4" aria-hidden />} onClick={() => ref.current?.close()}>
            Cancel
          </Button>
        </div>
      </form>
    </dialog>
  )
}
