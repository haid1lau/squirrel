import { AtSign, Plug, Plus, RefreshCw, Unplug, X } from 'lucide-react'
import { useCallback, useEffect, useEffectEvent, useId, useState, type FormEvent } from 'react'
import { useArmedAction } from '../hooks/useArmedAction'
import { api, errorMessage, type ImapAccount, type ScanStatus } from '../lib/api'
import { cn } from '../lib/cn'
import { formatDate } from '../lib/format'
import { fieldClass } from '../lib/styles'
import { useToast } from '../lib/toast'
import { SCAN_POLL_MS, ScanProgress, ScanResult } from './ScanStatus'
import { Button } from './ui/Button'
import { Card, CardHeader, CountChip } from './ui/Card'
import { Message } from './ui/Message'
import { Skeleton } from './ui/Skeleton'

// Where each provider hides its app passwords.
const APP_PASSWORD_HELP = [
  {
    name: 'Yahoo',
    steps: 'Account security → Generate app password',
    url: 'https://login.yahoo.com/account/security',
  },
  {
    name: 'iCloud',
    steps: 'Sign-In and Security → App-Specific Passwords',
    url: 'https://account.apple.com',
  },
  {
    name: 'AOL',
    steps: 'Account security → Generate app password',
    url: 'https://login.aol.com/account/security',
  },
  {
    name: 'Fastmail',
    steps: 'Settings → Privacy & Security → App passwords (IMAP access)',
    url: null,
  },
]

interface AccountRowProps {
  account: ImapAccount
  onRemoved: (id: string) => void
  onScanFinished: () => void
}

function AccountRow({ account, onRemoved, onScanFinished }: AccountRowProps) {
  const toast = useToast()
  const [scan, setScan] = useState<ScanStatus>(account.scan)
  const [lastSync, setLastSync] = useState(account.last_sync_at)
  const [starting, setStarting] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [armed, armOrConfirm, disarm] = useArmedAction()
  const running = scan.state === 'running'

  const finished = useEffectEvent((s: ScanStatus) => {
    if (s.state === 'done') {
      setLastSync(new Date().toISOString())
      onScanFinished()
    }
  })

  // Poll while a scan runs (it may already be running after a page reload).
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(async () => {
      try {
        const accounts = await api.imapAccounts()
        const s = accounts.find((a) => a.id === account.id)?.scan ?? {
          state: 'idle',
        }
        setScan(s)
        if (s.state !== 'running') finished(s)
      } catch (e) {
        setError(errorMessage(e))
      }
    }, SCAN_POLL_MS)
    return () => window.clearInterval(id)
  }, [running, account.id])

  async function startScan() {
    setError(null)
    setStarting(true)
    try {
      setScan(await api.scanImap(account.id))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setStarting(false)
    }
  }

  async function remove() {
    if (!armOrConfirm()) return
    setRemoving(true)
    try {
      await api.removeImap(account.id)
      onRemoved(account.id)
      toast('info', `Disconnected ${account.email}. Benefits already found are kept.`)
    } catch (e) {
      setError(errorMessage(e))
      setRemoving(false)
      disarm()
    }
  }

  return (
    <li className="grid gap-3 py-4 first:pt-0">
      <div>
        <p className="font-semibold [overflow-wrap:anywhere]">{account.email}</p>
        <p className="text-sm text-ink-muted">
          {lastSync ? `Last scanned ${formatDate(lastSync.slice(0, 10))}` : 'Not scanned yet'}
        </p>
      </div>
      <ScanProgress scan={scan} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          icon={<RefreshCw className="size-4" aria-hidden />}
          loading={starting || running}
          loadingLabel="Scanning…"
          onClick={startScan}
        >
          Scan inbox<span className="sr-only"> of {account.email}</span>
        </Button>
        <Button
          variant="danger"
          icon={<Unplug className="size-4" aria-hidden />}
          loading={removing}
          loadingLabel="Disconnecting…"
          onClick={remove}
          className={armed ? 'border-danger bg-danger-soft' : undefined}
        >
          {armed ? 'Click again to disconnect' : 'Disconnect'}
          <span className="sr-only"> {account.email}</span>
        </Button>
      </div>
      <div aria-live="polite" className="grid gap-2">
        <ScanResult scan={scan} />
        {error ? <Message tone="error">{error}</Message> : null}
      </div>
    </li>
  )
}

function ConnectForm({ onConnected, onCancel }: { onConnected: (a: ImapAccount) => void; onCancel?: () => void }) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [host, setHost] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Enter your email address and an app password.')
      return
    }
    setError(null)
    setConnecting(true)
    try {
      onConnected(await api.connectImap(email, password, host))
    } catch (err) {
      setError(errorMessage(err))
      setConnecting(false)
    }
  }

  const input = cn(fieldClass, 'border-line')

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4" aria-label="Connect another email account">
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-email`} className="text-sm font-semibold">
          Email address
        </label>
        <input
          id={`${id}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@yahoo.com"
          className={input}
        />
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-password`} className="text-sm font-semibold">
          App password
        </label>
        <input
          id={`${id}-password`}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
          aria-describedby={`${id}-password-hint`}
          className={input}
        />
        <p id={`${id}-password-hint`} className="text-xs text-ink-muted">
          Not your normal password: create an app password in your email account’s security settings.
        </p>
      </div>
      <details className="rounded-xl bg-surface-2 px-3.5 py-0.5 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">How do I get an app password?</summary>
        <ul className="grid gap-1.5 pb-3 text-ink-muted">
          {APP_PASSWORD_HELP.map((p) => (
            <li key={p.name}>
              <span className="font-semibold text-ink">{p.name}:</span>{' '}
              {p.url ? (
                <a
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block py-1 text-primary-text underline-offset-4 hover:underline"
                >
                  {p.steps}
                </a>
              ) : (
                p.steps
              )}
            </li>
          ))}
          <li>Two-step verification usually has to be on before app passwords appear.</li>
        </ul>
      </details>
      <div className="grid gap-1.5">
        <label htmlFor={`${id}-host`} className="text-sm font-semibold">
          IMAP server <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <input
          id={`${id}-host`}
          value={host}
          onChange={(e) => setHost(e.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="imap.example.com"
          aria-describedby={`${id}-host-hint`}
          className={input}
        />
        <p id={`${id}-host-hint`} className="text-xs text-ink-muted">
          Found automatically for Yahoo, iCloud, AOL, Fastmail, Zoho, GMX, mail.com and Yandex.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="primary"
          icon={<Plug className="size-4" aria-hidden />}
          loading={connecting}
          loadingLabel="Checking sign-in…"
        >
          Connect
        </Button>
        {onCancel ? (
          <Button icon={<X className="size-4" aria-hidden />} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
      {error ? <Message tone="error">{error}</Message> : null}
    </form>
  )
}

/** Email accounts other than Gmail, read over IMAP with an app password. */
export function EmailAccountsPanel({ onScanFinished }: { onScanFinished: () => void }) {
  const toast = useToast()
  const [accounts, setAccounts] = useState<ImapAccount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.imapAccounts().then(
      (a) => {
        if (cancelled) return
        setAccounts(a)
        setError(null)
      },
      (e) => !cancelled && setError(errorMessage(e)),
    )
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setError(null)
    setAttempt((n) => n + 1)
  }, [])

  const showForm = adding || accounts?.length === 0

  return (
    <Card as="article" aria-labelledby="imap-title" className="grid content-start">
      <CardHeader
        icon={AtSign}
        title="Other email"
        titleId="imap-title"
        action={accounts?.length ? <CountChip>{accounts.length} connected</CountChip> : null}
      />
      <div className="grid gap-4 p-5">
        {error ? (
          <div className="grid gap-3">
            <Message tone="error">Couldn’t load your email accounts: {error}</Message>
            <div>
              <Button icon={<RefreshCw className="size-4" aria-hidden />} onClick={retry}>
                Try again
              </Button>
            </div>
          </div>
        ) : !accounts ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : (
          <>
            {accounts.length === 0 ? (
              <>
                <p className="text-ink-muted">Connect Yahoo, iCloud, AOL or another email account.</p>
                <ul className="grid list-disc gap-1 pl-5 text-sm text-ink-muted">
                  <li>Squirrel only reads: it opens your inbox read-only and never marks email as read.</li>
                  <li>Same rules as Gmail: last 6 months, only emails that mention vouchers, memberships or expiry.</li>
                  <li>Those emails are sent to OpenAI’s API to pull out the benefit.</li>
                  <li>Hotel and airline memberships are spotted from who emails you (sender and subject only).</li>
                  <li>The app password is stored encrypted. Delete it at your provider any time to cut access.</li>
                  <li>Outlook and Hotmail aren’t supported yet.</li>
                </ul>
              </>
            ) : (
              <ul className="divide-y divide-line">
                {accounts.map((a) => (
                  <AccountRow
                    key={a.id}
                    account={a}
                    onScanFinished={onScanFinished}
                    onRemoved={(removedId) => setAccounts((curr) => curr?.filter((x) => x.id !== removedId) ?? curr)}
                  />
                ))}
              </ul>
            )}

            {showForm ? (
              <ConnectForm
                onCancel={accounts.length ? () => setAdding(false) : undefined}
                onConnected={(account) => {
                  setAccounts((curr) => [...(curr ?? []), account])
                  setAdding(false)
                  toast('success', `Connected ${account.email}. Scan the inbox to find benefits.`)
                }}
              />
            ) : (
              <div>
                <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setAdding(true)}>
                  Add another address
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
