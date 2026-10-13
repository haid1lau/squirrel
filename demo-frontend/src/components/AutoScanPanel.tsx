import { CalendarClock } from 'lucide-react'
import { useState } from 'react'
import { api, errorMessage, type AutoScanStatus } from '../lib/api'
import { cn } from '../lib/cn'
import { Card, CardHeader } from './ui/Card'
import { Message } from './ui/Message'

interface AutoScanPanelProps {
  status: AutoScanStatus
  /** The new status after a change; it may have started today's scan. */
  onChange: (status: AutoScanStatus) => void
}

/** The daily scan switch. Off until the user turns it on. */
export function AutoScanPanel({ status, onChange }: AutoScanPanelProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setError(null)
    setSaving(true)
    try {
      onChange(await api.setAutoScan(!status.enabled))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card as="section" aria-labelledby="auto-scan-title" className="grid content-start">
      <CardHeader icon={CalendarClock} title="Daily scan" titleId="auto-scan-title" />
      <div className="grid gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <p id="auto-scan-note" className="text-ink-muted">
            Scan every connected inbox once a day, when you open Squirrel. Nothing is scanned while you’re away.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={status.enabled}
            aria-labelledby="auto-scan-title"
            aria-describedby="auto-scan-note"
            disabled={saving}
            onClick={toggle}
            className="grid min-h-11 shrink-0 place-items-center disabled:opacity-60"
          >
            <span
              className={cn(
                'relative h-7 w-12 rounded-full transition-colors',
                status.enabled ? 'bg-cta' : 'bg-line',
              )}
            >
              <span
                className={cn(
                  'absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform',
                  status.enabled && 'translate-x-5',
                )}
              />
            </span>
          </button>
        </div>
        {status.enabled && status.running ? (
          <p className="text-sm font-semibold" aria-live="polite">
            Today’s scan is running…
          </p>
        ) : null}
        {error ? <Message tone="error">{error}</Message> : null}
      </div>
    </Card>
  )
}
