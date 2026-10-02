import { Bell, Check, CircleCheck, Coins, Copy, EyeOff, Pencil, Receipt, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useArmedAction } from '../hooks/useArmedAction'
import { api, DEFAULT_REMINDER_DAYS, errorMessage, REMINDER_DAYS, type Benefit, type QuickChange } from '../lib/api'
import { cn } from '../lib/cn'
import { formatPoints, reminderLabel } from '../lib/format'
import { celebrate, collapse, prefersReducedMotion } from '../lib/motion'
import { fieldClass } from '../lib/styles'
import { useToast } from '../lib/toast'
import { creditLeft, formatMoney, resetDate, usageKind } from '../lib/usage'
import { Button } from './ui/Button'
import { Message } from './ui/Message'
import { MoreMenu, type MoreMenuItem } from './ui/MoreMenu'

interface BenefitActionsProps {
  benefit: Benefit
  onEdit: () => void
  onUpdated: (benefit: Benefit) => void
  onRemoved: (id: string) => void
}

/** A benefit's main button (by kind, see lib/usage.ts), its balance, and the ⋯ menu with Edit, Reminder and Remove. */
export function BenefitActions({ benefit, onEdit, onUpdated, onRemoved }: BenefitActionsProps) {
  const toast = useToast()
  const [panel, setPanel] = useState<'log' | 'points' | 'reminder' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [armed, armedClick, disarm] = useArmedAction()
  const [flash, setFlash] = useState(false)
  const name = benefit.benefit_name || 'Untitled benefit'
  const kind = benefit.needs_review ? null : usageKind(benefit)
  const isCard = benefit.source === 'card'
  const total = benefit.credit_total ?? 0
  const left = creditLeft(benefit)

  /**
   * Saves a quick change; `undo` (the old values) adds an Undo button to the toast.
   * `leaving` (the row) plays the "done" animation first: a check mark, then the row folds away.
   */
  async function save(change: QuickChange, message: string, undo?: QuickChange, leaving?: Element | null) {
    setBusy(true)
    setError(null)
    try {
      const saved = await api.quickUpdate(benefit.id, change)
      // As in the design: falling acorns each time something is used (Mark as used or Log a use),
      // starting with the check mark. Not for undo, balances or reminders.
      if (change.used === true || (change.used_amount ?? 0) > (benefit.used_amount ?? 0)) celebrate()
      if (leaving) {
        setFlash(true)
        if (!prefersReducedMotion()) await new Promise((r) => window.setTimeout(r, 450))
        await collapse(leaving)
      }
      onUpdated(saved)
      setPanel(null)
      toast(
        'success',
        message,
        undo && {
          label: 'Undo',
          onClick: () =>
            api
              .quickUpdate(benefit.id, undo)
              .then(onUpdated, (e) => toast('error', `Couldn’t undo: ${errorMessage(e)}`)),
        },
      )
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setError(null)
    try {
      await api.dismiss(benefit.id)
      onRemoved(benefit.id)
      toast('info', isCard ? `Hid “${name}” until it resets.` : `Removed “${name}”.`)
    } catch (e) {
      setError(errorMessage(e))
      disarm()
    }
  }

  const menu: MoreMenuItem[] = [{ label: 'Edit', icon: Pencil, onSelect: onEdit }]
  // Reminders count down to the expiry date, so only benefits with one get them.
  if (benefit.expiry_date) menu.push({ label: 'Reminder', icon: Bell, onSelect: () => setPanel('reminder') })
  if (kind === 'credit' && benefit.used_amount) {
    menu.push({
      label: 'Mark as unused',
      icon: RotateCcw,
      onSelect: () =>
        save({ used: false }, `Reset “${name}” to ${formatMoney(total)}.`, { used_amount: benefit.used_amount ?? 0 }),
    })
  }
  menu.push({
    label: armed ? 'Click again to confirm' : isCard ? 'Hide until it resets' : 'Remove',
    icon: isCard ? EyeOff : Trash2,
    danger: true,
    keepOpen: !armed,
    onSelect: () => {
      if (armedClick()) void remove()
    },
  })

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        {kind === 'one-time' ? (
          <Button
            variant="primary"
            icon={flash ? undefined : <CircleCheck className="size-4" aria-hidden />}
            loading={busy && !flash}
            loadingLabel="Saving…"
            onClick={(e) =>
              save({ used: true }, `Marked “${name}” as used.`, { used: false }, e.currentTarget.closest('li'))
            }
            className="relative"
          >
            <span className={cn('transition-opacity duration-150', flash && 'opacity-0')}>
              Mark as used<span className="sr-only"> {name}</span>
            </span>
            {flash ? (
              <span aria-hidden className="absolute inset-0 grid place-items-center">
                <Check className="size-5 animate-pop" strokeWidth={3} />
              </span>
            ) : null}
          </Button>
        ) : null}

        {benefit.code ? <CopyCode code={benefit.code} name={name} /> : null}

        {kind === 'credit' && left > 0 ? (
          <Button
            variant="primary"
            icon={<Receipt className="size-4" aria-hidden />}
            aria-expanded={panel === 'log'}
            onClick={() => setPanel((p) => (p === 'log' ? null : 'log'))}
          >
            Log a use<span className="sr-only"> of {name}</span>
          </Button>
        ) : null}

        {kind === 'credit' ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-muted">
            {left > 0
              ? `${formatMoney(left)} of ${formatMoney(total)} left`
              : `Used up · resets ${resetDate(benefit) ?? 'next period'}`}
            {left > 0 ? (
              <span aria-hidden className="h-1 w-11 overflow-hidden rounded-full bg-line">
                <span className="block h-full bg-cta" style={{ width: `${(left / total) * 100}%` }} />
              </span>
            ) : null}
          </span>
        ) : null}

        {kind === 'points' ? (
          <Button
            variant="primary"
            icon={<Coins className="size-4" aria-hidden />}
            aria-expanded={panel === 'points'}
            onClick={() => setPanel((p) => (p === 'points' ? null : 'points'))}
          >
            Update balance<span className="sr-only"> for {name}</span>
          </Button>
        ) : null}

        <div className="ml-auto">
          <MoreMenu label={`More actions for ${name}`} items={menu} />
        </div>
      </div>

      {panel === 'log' ? (
        <LogUseForm
          left={left}
          busy={busy}
          onCancel={() => setPanel(null)}
          onSave={(amount) => {
            const before = benefit.used_amount ?? 0
            const after = Math.round((before + amount) * 100) / 100
            const remaining = Math.max(0, total - after)
            save(
              { used_amount: after },
              remaining > 0
                ? `Logged ${formatMoney(amount)} on “${name}”. ${formatMoney(remaining)} left.`
                : `Used all of “${name}”. It resets ${resetDate(benefit) ?? 'next period'}.`,
              { used_amount: before },
            )
          }}
        />
      ) : null}

      {panel === 'points' ? (
        <PointsForm
          benefit={benefit}
          busy={busy}
          onCancel={() => setPanel(null)}
          onSave={(points) =>
            save(
              { points },
              `Updated “${name}” to ${formatPoints(Number(points.replace(/,/g, '')), benefit.points_unit)}.`,
              { points: benefit.points ?? null },
            )
          }
        />
      ) : null}

      {panel === 'reminder' ? (
        <ReminderForm
          benefit={benefit}
          busy={busy}
          onCancel={() => setPanel(null)}
          onSave={(reminder) =>
            save(
              { reminder },
              reminder === 'off'
                ? `No reminder for “${name}”.`
                : `You’ll get an email ${reminderLabel(reminder).toLowerCase()} “${name}” expires.`,
              { reminder: benefit.reminder ?? null },
            )
          }
        />
      ) : null}

      {error ? <Message tone="error">{error}</Message> : null}
    </div>
  )
}

const COPIED_MS = 1200

/**
 * The code, hidden under drifting dots (like Telegram's spoilers) until tapped, so it isn't read over a
 * shoulder; then as selectable text, for reading out at a till. Copy works either way.
 */
function CopyCode({ code, name }: { code: string; name: string }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [shown, setShown] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      setShown(true)
      toast('error', 'Couldn’t copy. Select the code and copy it yourself.')
      return
    }
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
    toast('success', `Copied the code for “${name}”.`)
  }

  return (
    <span className="inline-flex items-center gap-2">
      {shown ? (
        <code className="animate-rise rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-sm font-semibold tracking-wide select-all">
          {code}
        </code>
      ) : (
        <button
          type="button"
          onClick={() => setShown(true)}
          title="Show code"
          className="cursor-pointer rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-sm font-semibold tracking-wide transition-colors duration-150 hover:bg-line"
        >
          {/* The code keeps the chip its real width, drawn invisible under the dots. */}
          <span aria-hidden className="spoiler select-none">
            {code}
          </span>
          <span className="sr-only">Show the code for {name}</span>
        </button>
      )}
      <Button
        icon={
          copied ? (
            <Check className="size-4 animate-rise text-ok" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )
        }
        onClick={copy}
        aria-live="polite"
      >
        {copied ? 'Copied' : 'Copy code'}
        <span className="sr-only"> for {name}</span>
      </Button>
    </span>
  )
}

interface ReminderFormProps {
  benefit: Benefit
  busy: boolean
  onCancel: () => void
  onSave: (reminder: number | 'off') => void
}

/** When to email about a benefit, from 1 week to 1 year before it expires, or not at all. */
function ReminderForm({ benefit, busy, onCancel, onSave }: ReminderFormProps) {
  const id = useId()
  const [value, setValue] = useState(String(benefit.reminder ?? DEFAULT_REMINDER_DAYS))

  function submit(e: FormEvent) {
    e.preventDefault()
    onSave(value === 'off' ? 'off' : Number(value))
  }

  return (
    <form onSubmit={submit} className="grid gap-2 rounded-xl bg-surface-2 p-3 sm:max-w-md">
      <label htmlFor={id} className="text-sm font-semibold">
        Email me
      </label>
      <div className="flex flex-wrap gap-2">
        {/* Wrapped, as fieldClass is full width. */}
        <div className="w-48 flex-none">
          <select
            id={id}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-describedby={`${id}-hint`}
            className={cn(fieldClass, 'border-line')}
          >
            {/* An older choice that's no longer offered (like 3 days) stays selectable until changed. */}
            {typeof benefit.reminder === 'number' && !(benefit.reminder in REMINDER_DAYS) ? (
              <option value={benefit.reminder}>{reminderLabel(benefit.reminder)}</option>
            ) : null}
            {Object.entries(REMINDER_DAYS).map(([days, label]) => (
              <option key={days} value={days}>
                {label}
              </option>
            ))}
            <option value="off">Don’t remind me</option>
          </select>
        </div>
        <Button type="submit" variant="primary" loading={busy} loadingLabel="Saving…">
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-ink-muted">
        Sent to your account’s email, after 8am your time.
      </p>
    </form>
  )
}

interface LogUseFormProps {
  left: number
  busy: boolean
  onCancel: () => void
  onSave: (amount: number) => void
}

function LogUseForm({ left, busy, onCancel, onSave }: LogUseFormProps) {
  const id = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const amount = Number(value.replace(/[$,\s]/g, ''))
    if (!value.trim() || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter how much you spent, like 12.50.')
    } else if (amount > left + 0.004) {
      setError(`That’s more than the ${formatMoney(left)} left. Use all instead?`)
    } else {
      onSave(Math.min(amount, left))
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-2 rounded-xl bg-surface-2 p-3 sm:max-w-md">
      <label htmlFor={id} className="text-sm font-semibold">
        Amount used ({formatMoney(left)} left)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          autoFocus
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          className={cn(fieldClass, 'w-32 flex-none', error ? 'border-danger' : 'border-line')}
        />
        <Button
          onClick={() => {
            setValue(String(left))
            setError(null)
          }}
        >
          Use all
        </Button>
        <Button type="submit" variant="primary" loading={busy} loadingLabel="Saving…">
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </form>
  )
}

interface PointsFormProps {
  benefit: Benefit
  busy: boolean
  onCancel: () => void
  onSave: (points: string) => void
}

function PointsForm({ benefit, busy, onCancel, onSave }: PointsFormProps) {
  const id = useId()
  const [value, setValue] = useState(String(benefit.points ?? ''))
  const [error, setError] = useState<string | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!/^\d[\d,]*$/.test(value.trim())) {
      setError('Enter a whole number, like 12500.')
      return
    }
    onSave(value.trim())
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-2 rounded-xl bg-surface-2 p-3 sm:max-w-md">
      <label htmlFor={id} className="text-sm font-semibold">
        New balance ({benefit.points_unit ?? 'points'})
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          autoFocus
          inputMode="numeric"
          autoComplete="off"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          className={cn(fieldClass, 'w-40 flex-none', error ? 'border-danger' : 'border-line')}
        />
        <Button type="submit" variant="primary" loading={busy} loadingLabel="Saving…">
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </form>
  )
}
