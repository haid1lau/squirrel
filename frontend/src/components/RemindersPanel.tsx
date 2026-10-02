import { Bell, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api, CATEGORIES, errorMessage, REMINDER_DAYS, type ReminderSettings } from '../lib/api'
import { cn } from '../lib/cn'
import { fieldClass } from '../lib/styles'
import { useToast } from '../lib/toast'
import { Button } from './ui/Button'
import { Card, CardHeader, CountChip } from './ui/Card'
import { Message } from './ui/Message'
import { Skeleton } from './ui/Skeleton'

type Choices = Pick<ReminderSettings, 'enabled' | 'days_before' | 'categories'>

const selectClass = cn(fieldClass, 'disabled:cursor-not-allowed disabled:opacity-60')

/** "Asia/Singapore" -> "Singapore". */
const placeName = (timezone: string) => timezone.split('/').pop()?.replace(/_/g, ' ')

/**
 * The account's reminder emails: on or off, the usual timing, and a different timing for some
 * categories (say 6 months for travel). Each benefit can override all of it from its Edit form.
 */
export function RemindersPanel() {
  const toast = useToast()
  const [settings, setSettings] = useState<ReminderSettings | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(() => {
    api.reminders().then(setSettings, (e) => setLoadError(errorMessage(e)))
  }, [])
  useEffect(fetchSettings, [fetchSettings])

  // The reminder email links to /connections#reminders.
  const loaded = settings != null
  useEffect(() => {
    if (loaded && window.location.hash === '#reminders')
      document.getElementById('reminders')?.scrollIntoView({ block: 'start' })
  }, [loaded])

  async function save(changes: Partial<Choices>, message: string) {
    if (!settings) return
    const previous = settings
    const next = { ...settings, ...changes }
    setSettings(next) // show the change straight away
    setSaving(true)
    try {
      setSettings(
        await api.saveReminders({ enabled: next.enabled, days_before: next.days_before, categories: next.categories }),
      )
      toast('success', message)
    } catch (e) {
      setSettings(previous)
      toast('error', errorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  function setCategory(category: string, value: string) {
    if (!settings) return
    const categories = { ...settings.categories }
    if (value === 'usual') delete categories[category]
    else categories[category] = value === 'off' ? 'off' : Number(value)
    const label = CATEGORIES[category]
    save(
      { categories },
      value === 'usual'
        ? `${label} uses your usual reminder.`
        : value === 'off'
          ? `No reminders for ${label.toLowerCase()}.`
          : `${label}: ${REMINDER_DAYS[Number(value)].toLowerCase()} expiry.`,
    )
  }

  const off = !settings?.enabled

  return (
    <Card as="article" id="reminders" aria-labelledby="reminders-title" className="grid scroll-mt-20 content-start">
      <CardHeader
        icon={Bell}
        title="Reminders"
        titleId="reminders-title"
        action={settings ? <CountChip>{settings.enabled ? 'On' : 'Off'}</CountChip> : null}
      />
      <div className="grid gap-5 p-5">
        {loadError ? (
          <div className="grid gap-3">
            <Message tone="error">Couldn’t load your reminder settings: {loadError}</Message>
            <div>
              <Button
                icon={<RefreshCw className="size-4" aria-hidden />}
                onClick={() => {
                  setLoadError(null)
                  fetchSettings()
                }}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : !settings ? (
          <Skeleton className="h-28 rounded-xl" />
        ) : (
          <>
            <label className="flex min-h-11 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={settings.enabled}
                disabled={saving}
                onChange={(e) =>
                  save(
                    { enabled: e.target.checked },
                    e.target.checked ? 'Reminder emails turned on.' : 'Reminder emails turned off.',
                  )
                }
                className="size-5 shrink-0 cursor-pointer accent-primary"
              />
              <span>
                <span className="block font-semibold">Email me before benefits expire</span>
                <span className="block text-sm break-all text-ink-muted">
                  Sent to {settings.email}
                  {settings.timezone ? `, after 8am ${placeName(settings.timezone)} time` : ', after 8am'}
                </span>
              </span>
            </label>

            <div className="grid gap-1.5">
              <label htmlFor="reminder-days" className={cn('text-sm font-semibold', off && 'text-ink-muted')}>
                Usually remind me
              </label>
              <select
                id="reminder-days"
                value={settings.days_before}
                disabled={off || saving}
                onChange={(e) => {
                  const days = Number(e.target.value)
                  save({ days_before: days }, `Usual reminder: ${REMINDER_DAYS[days].toLowerCase()} expiry.`)
                }}
                className={cn(selectClass, 'border-line')}
              >
                {Object.entries(REMINDER_DAYS).map(([days, label]) => (
                  <option key={days} value={days}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="grid gap-3" disabled={off || saving}>
              <legend className={cn('mb-1 text-sm font-semibold', off && 'text-ink-muted')}>By category</legend>
              <p className="text-xs text-ink-muted">
                For example, travel 6 months before and dining 1 month before.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(CATEGORIES).map(([category, label]) => {
                  const choice = settings.categories[category]
                  return (
                    <div key={category} className="grid gap-1">
                      <label htmlFor={`reminder-${category}`} className="text-sm">
                        {label}
                      </label>
                      <select
                        id={`reminder-${category}`}
                        value={choice == null ? 'usual' : String(choice)}
                        onChange={(e) => setCategory(category, e.target.value)}
                        className={cn(selectClass, choice != null ? 'border-primary/60' : 'border-line')}
                      >
                        <option value="usual">Usual ({REMINDER_DAYS[settings.days_before].toLowerCase()})</option>
                        {Object.entries(REMINDER_DAYS).map(([days, dayLabel]) => (
                          <option key={days} value={days}>
                            {dayLabel}
                          </option>
                        ))}
                        <option value="off">Don’t remind me</option>
                      </select>
                    </div>
                  )
                })}
              </div>
              <p className="text-xs text-ink-muted">
                To change it for one benefit, use Edit on All Benefits. Benefits waiting for review are reminded once
                you confirm their date.
              </p>
            </fieldset>

            {!settings.email_enabled ? (
              <Message tone="warn">
                Email isn’t set up on the server yet, so reminders only appear in the server’s terminal.
              </Message>
            ) : null}
          </>
        )}
      </div>
    </Card>
  )
}
