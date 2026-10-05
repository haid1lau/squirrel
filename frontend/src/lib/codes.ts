import type { Benefit } from './api'

// Matching a scanned QR code or barcode to the benefits Squirrel already has.
// A code only holds text (the voucher code, or a link), so it can only be
// matched against codes Squirrel found in emails or that were typed in.

/** Letters and digits only, in capitals: "bday-7q2k" and "BDAY 7Q2K" are the same code. */
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

// Shorter codes would match inside unrelated links and numbers by chance.
const MIN_CONTAINED = 5

/**
 * Benefits whose code is the scanned text, or (for codes of MIN_CONTAINED or
 * more characters) appears inside it, as in a redemption link that ends with
 * the code. Exact matches come first.
 */
export function matchCode(scanned: string, benefits: Benefit[]): Benefit[] {
  const target = normalizeCode(scanned)
  if (!target) return []
  const exact: Benefit[] = []
  const contained: Benefit[] = []
  for (const b of benefits) {
    const code = b.code ? normalizeCode(b.code) : ''
    if (!code) continue
    if (code === target) exact.push(b)
    else if (code.length >= MIN_CONTAINED && target.includes(code)) contained.push(b)
  }
  return [...exact, ...contained]
}

/** The scanned text as a web link, if it is one. */
export function asLink(scanned: string): URL | null {
  try {
    const url = new URL(scanned.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}
