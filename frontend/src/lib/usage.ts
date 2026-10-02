import type { Benefit } from './api'

/**
 * What a benefit's main button does, by kind:
 * - credit: a card credit with a dollar amount. "Log a use" spends part of it.
 * - points: a points or miles balance. "Update balance".
 * - subscription: a renewal reminder switch.
 * - membership: always on, so no main button.
 * - one-time: vouchers and the rest. "Mark as used" moves it to the Used list.
 */
export type UsageKind = 'credit' | 'points' | 'subscription' | 'membership' | 'one-time'

export function usageKind(b: Benefit): UsageKind {
  if (b.credit_total != null) return 'credit'
  if (b.points != null) return 'points'
  if (b.type === 'subscription') return 'subscription'
  if (b.type === 'membership') return 'membership'
  return 'one-time'
}

/**
 * Used up and moved to the Used list. Card credits stay in the main list
 * ("Used up · resets …") because they come back each period.
 */
export const isArchived = (b: Benefit) => Boolean(b.used_on) && usageKind(b) !== 'credit'

/** What's left of a card credit this period, in dollars. */
export const creditLeft = (b: Benefit) => Math.max(0, (b.credit_total ?? 0) - (b.used_amount ?? 0))

// "$50" for whole dollars, "$12.50" otherwise.
const wholeDollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export const formatMoney = (n: number) => (Number.isInteger(n) ? wholeDollars : cents).format(n)

/** The day after a credit's period ends, when it resets. */
export function resetDate(b: Benefit): string | null {
  if (!b.expiry_date) return null
  const d = new Date(`${b.expiry_date}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
