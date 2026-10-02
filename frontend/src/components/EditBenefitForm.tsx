import { Check, X } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { api, CATEGORIES, errorMessage, TYPES, type Benefit, type BenefitEdit } from '../lib/api'
import { cn } from '../lib/cn'
import { capitalize } from '../lib/format'
import { fieldClass } from '../lib/styles'
import { Button } from './ui/Button'
import { Message } from './ui/Message'

interface EditBenefitFormProps {
  /** The benefit to edit; leave out to add a new one. */
  benefit?: Benefit
  onSaved: (benefit: Benefit) => void
  onCancel: () => void
  /** 'li' when the form replaces a row in a list. */
  as?: 'li' | 'div'
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  )
}

/** Adds a benefit, or edits one when `benefit` is given. */
export function EditBenefitForm({ benefit, onSaved, onCancel, as: Tag = 'li' }: EditBenefitFormProps) {
  const id = useId()
  const [form, setForm] = useState<BenefitEdit>({
    benefit_name: benefit?.benefit_name ?? '',
    provider: benefit?.provider ?? '',
    type: benefit?.type ?? 'voucher',
    category: benefit?.category ?? 'other',
    value: benefit?.value ?? '',
    points: benefit?.points != null ? String(benefit.points) : '',
    expiry_date: benefit?.expiry_date ?? '',
    terms_summary: benefit?.terms_summary ?? '',
    code: benefit?.code ?? '',
  })
  // A benefit is worth either a value ("$50") or a points balance; memberships default to points.
  const [worth, setWorth] = useState<'value' | 'points'>(
    benefit?.points != null || benefit?.source === 'loyalty' ? 'points' : 'value',
  )
  const [nameError, setNameError] = useState<string | null>(null)
  const [pointsError, setPointsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (key: keyof BenefitEdit) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.benefit_name.trim()) {
      setNameError('Give the benefit a name.')
      document.getElementById(`${id}-name`)?.focus()
      return
    }
    setNameError(null)
    if (worth === 'points' && form.points.trim() && !/^[\d,\s]+$/.test(form.points)) {
      setPointsError('Enter points as a whole number, like 12500.')
      document.getElementById(`${id}-points`)?.focus()
      return
    }
    setPointsError(null)
    setError(null)
    setSaving(true)
    const fields = {
      ...form,
      value: worth === 'value' ? form.value : '',
      points: worth === 'points' ? form.points : '',
    }
    try {
      onSaved(await (benefit ? api.updateBenefit(benefit.id, fields) : api.createBenefit(fields)))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <Tag className="px-5 py-4">
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label={benefit ? `Edit ${benefit.benefit_name || 'benefit'}` : 'Add a benefit'}
        className="grid gap-4 rounded-xl border border-primary/40 bg-primary-soft/40 p-4"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${id}-name`} label="Name">
            <input
              id={`${id}-name`}
              value={form.benefit_name}
              onChange={set('benefit_name')}
              maxLength={200}
              autoFocus
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${id}-name-error` : undefined}
              className={cn(fieldClass, nameError ? 'border-danger' : 'border-line')}
            />
            {nameError ? (
              <p id={`${id}-name-error`} role="alert" className="text-sm font-medium text-danger">
                {nameError}
              </p>
            ) : null}
          </Field>
          <Field id={`${id}-provider`} label="Provider">
            <input
              id={`${id}-provider`}
              value={form.provider}
              onChange={set('provider')}
              maxLength={200}
              className={cn(fieldClass, 'border-line')}
            />
          </Field>
          <Field id={`${id}-type`} label="Type">
            <select
              id={`${id}-type`}
              value={form.type}
              onChange={set('type')}
              className={cn(fieldClass, 'border-line')}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {capitalize(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field id={`${id}-category`} label="Category">
            <select
              id={`${id}-category`}
              value={form.category}
              onChange={set('category')}
              className={cn(fieldClass, 'border-line')}
            >
              {Object.entries(CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="grid content-start gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">Worth</legend>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
              {(['value', 'points'] as const).map((option) => (
                <label
                  key={option}
                  className={cn(
                    'flex min-h-9 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-focus',
                    worth === option ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-worth`}
                    value={option}
                    checked={worth === option}
                    onChange={() => setWorth(option)}
                    className="sr-only"
                  />
                  {option === 'value' ? 'Value' : 'Points'}
                </label>
              ))}
            </div>
            {worth === 'value' ? (
              <>
                <label htmlFor={`${id}-value`} className="sr-only">
                  Value
                </label>
                <input
                  id={`${id}-value`}
                  value={form.value}
                  onChange={set('value')}
                  maxLength={100}
                  aria-describedby={`${id}-worth-hint`}
                  className={cn(fieldClass, 'border-line')}
                />
                <p id={`${id}-worth-hint`} className="text-xs text-ink-muted">
                  For example $50, 20% off or 1 free night.
                </p>
              </>
            ) : (
              <>
                <label htmlFor={`${id}-points`} className="sr-only">
                  Points balance
                </label>
                <input
                  id={`${id}-points`}
                  value={form.points}
                  onChange={set('points')}
                  inputMode="numeric"
                  placeholder="12,500"
                  aria-invalid={pointsError ? true : undefined}
                  aria-describedby={pointsError ? `${id}-points-error` : `${id}-worth-hint`}
                  className={cn(fieldClass, pointsError ? 'border-danger' : 'border-line')}
                />
                {pointsError ? (
                  <p id={`${id}-points-error`} role="alert" className="text-sm font-medium text-danger">
                    {pointsError}
                  </p>
                ) : (
                  <p id={`${id}-worth-hint`} className="text-xs text-ink-muted">
                    Your points or miles balance, like hotel or airline points.
                  </p>
                )}
              </>
            )}
          </fieldset>
          <Field id={`${id}-expiry`} label="Expiry date" hint="Leave empty if it doesn’t expire.">
            <input
              id={`${id}-expiry`}
              type="date"
              value={form.expiry_date}
              onChange={set('expiry_date')}
              className={cn(fieldClass, 'border-line')}
            />
          </Field>
          <Field id={`${id}-code`} label="Code" hint="The voucher or promo code to use at checkout, if it has one.">
            <input
              id={`${id}-code`}
              value={form.code}
              onChange={set('code')}
              maxLength={64}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className={cn(fieldClass, 'border-line font-mono')}
            />
          </Field>
          <Field id={`${id}-terms`} label="Terms">
            <textarea
              id={`${id}-terms`}
              value={form.terms_summary}
              onChange={set('terms_summary')}
              maxLength={500}
              rows={2}
              className={cn(fieldClass, 'border-line')}
            />
          </Field>
        </div>

        {benefit?.needs_review ? (
          <p className="text-sm text-ink-muted">Saving also takes this benefit out of the review queue.</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="primary"
            icon={<Check className="size-4" aria-hidden />}
            loading={saving}
            loadingLabel="Saving…"
          >
            {benefit ? 'Save changes' : 'Add benefit'}
          </Button>
          <Button icon={<X className="size-4" aria-hidden />} onClick={onCancel}>
            Cancel
          </Button>
        </div>

        {error ? <Message tone="error">{error}</Message> : null}
      </form>
    </Tag>
  )
}
