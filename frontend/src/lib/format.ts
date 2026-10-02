import { DEFAULT_REMINDER_DAYS, REMINDER_DAYS } from './api'

// Hoisted so the formatter isn't rebuilt on every render.
const dateFormat = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const longDayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00`))
export const formatToday = () => longDayFormat.format(new Date())

const numberFormat = new Intl.NumberFormat()
export const formatPoints = (points: number, unit = 'points') => `${numberFormat.format(points)} ${unit}`

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s)

/** "1 week before" for a benefit's reminder in days (null is the default). Older choices, like 3, read "3 days before". */
export const reminderLabel = (days: number | null | undefined) => {
  const d = days ?? DEFAULT_REMINDER_DAYS
  return REMINDER_DAYS[d] ?? (d === 0 ? 'On the day' : `${d} day${d === 1 ? '' : 's'} before`)
}

export type Tone = 'danger' | 'warn' | 'ok' | 'neutral'

/** Colour and text always travel together, so colour is never the only signal. */
export function urgency(days: number | null): { tone: Tone; label: string } {
  if (days == null) return { tone: 'neutral', label: 'No expiry' }
  if (days < 0) return { tone: 'danger', label: 'Expired' }
  if (days === 0) return { tone: 'danger', label: 'Expires today' }
  const label = days === 1 ? '1 day left' : `${days} days left`
  if (days <= 7) return { tone: 'danger', label }
  if (days <= 30) return { tone: 'warn', label }
  return { tone: 'ok', label }
}
