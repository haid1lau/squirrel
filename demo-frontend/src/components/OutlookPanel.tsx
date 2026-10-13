import { Inbox, LogIn, RefreshCw, Unplug } from 'lucide-react'
import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { useArmedAction } from '../hooks/useArmedAction'
import { api, errorMessage, MICROSOFT_CONNECT_URL, type OutlookConnection, type ScanStatus } from '../lib/api'
import { formatDate } from '../lib/format'
import { useToast } from '../lib/toast'
import { SCAN_POLL_MS, ScanProgress, ScanResult } from './ScanStatus'
import { Button } from './ui/Button'
import { Card, CardHeader } from './ui/Card'
import { Message } from './ui/Message'
import { Skeleton } from './ui/Skeleton'

interface OutlookPanelProps {
  microsoftEnabled: boolean
  onScanFinished: () => void
}

/** Outlook, Hotmail and Microsoft 365, connected through Microsoft's own sign-in (they don't allow app passwords). */
export function OutlookPanel({ microsoftEnabled, onScanFinished }: OutlookPanelProps) {
  const toast = useToast()
  // undefined while loading; null when not connected.
  const [connection, setConnection] = useState<OutlookConnection | null | undefined>(undefined)
  const [scan, setScan] = useState<ScanStatus>({ state: 'idle' })
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [armed, armOrConfirm, disarm] = useArmedAction()
  const running = scan.state === 'running'

  const load = useCallback(async () => {
    try {
      const status = await api.outlookStatus()
      setConnection(status.connection)
      setScan(status.scan)
    } catch (e) {
      setError(errorMessage(e))
    }
  }, [])

  const finished = useEffectEvent((s: ScanStatus) => {
    if (s.state === 'done') {
      onScanFinished()
      setConnection((c) => c && { ...c, last_sync_at: new Date().toISOString() })
    }
    // Removed access disconnects Outlook on the server; reload to show that.
    if (s.state === 'error') void load()
  })

  useEffect(() => {
    if (!microsoftEnabled) return
    let cancelled = false
    api.outlookStatus().then(
      (status) => {
        if (cancelled) return
        setConnection(status.connection)
        setScan(status.scan)
      },
      (e) => !cancelled && setError(errorMessage(e)),
    )
    return () => {
      cancelled = true
    }
  }, [microsoftEnabled])

  // Poll while a scan runs.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(async () => {
      try {
        const { scan: s } = await api.outlookStatus()
        setScan(s)
        if (s.state !== 'running') finished(s)
      } catch (e) {
        setError(errorMessage(e))
      }
    }, SCAN_POLL_MS)
    return () => window.clearInterval(id)
  }, [running])

  async function startScan() {
    setError(null)
    setStarting(true)
    try {
      setScan(await api.scanOutlook())
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setStarting(false)
    }
  }

  async function disconnect() {
    if (!armOrConfirm()) return
    setDisconnecting(true)
    try {
      await api.disconnectOutlook()
      toast(
        'info',
        'Outlook disconnected. Benefits already found are kept. To remove Squirrel from your Microsoft account too, open account.live.com/consent/Manage.',
      )
      setScan({ state: 'idle' })
      setConnection(null)
    } catch (e) {
      setError(errorMessage(e))
      disarm()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card as="article" aria-labelledby="outlook-title" className="grid content-start">
      <CardHeader icon={Inbox} title="Outlook" titleId="outlook-title" />
      <div className="grid gap-4 p-5">
        {!microsoftEnabled ? (
          <Message tone="info">
            Outlook isn’t set up on this server yet. Add <code>MICROSOFT_CLIENT_ID</code> and{' '}
            <code>MICROSOFT_CLIENT_SECRET</code> to <code>.env</code> and restart <code>server.py</code>.
          </Message>
        ) : connection === undefined && !error ? (
          <Skeleton className="h-16 rounded-xl" />
        ) : !connection ? (
          <>
            <p className="text-ink-muted">
              Connect Outlook, Hotmail, Live or a Microsoft 365 work account. You sign in with Microsoft; Squirrel only
              reads your email.
            </p>
            <div>
              <Button
                variant="primary"
                icon={<LogIn className="size-4" aria-hidden />}
                onClick={() => window.location.assign(MICROSOFT_CONNECT_URL)}
              >
                Connect Outlook
              </Button>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="font-semibold [overflow-wrap:anywhere]">{connection.email}</p>
              <p className="text-sm text-ink-muted">
                {connection.last_sync_at
                  ? `Last scanned ${formatDate(connection.last_sync_at.slice(0, 10))}`
                  : 'Not scanned yet'}
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
                Scan mailbox
              </Button>
              <Button
                variant="danger"
                icon={<Unplug className="size-4" aria-hidden />}
                loading={disconnecting}
                loadingLabel="Disconnecting…"
                onClick={disconnect}
                className={armed ? 'border-danger bg-danger-soft' : undefined}
              >
                {armed ? 'Click again to disconnect' : 'Disconnect'}
              </Button>
            </div>
            <p className="text-xs text-ink-muted">
              Each scan reads up to 50 new emails, 5 at a time. A full scan can take a few minutes.
            </p>
          </>
        )}

        <div aria-live="polite" className="grid gap-2">
          <ScanResult scan={scan} />
          {error ? <Message tone="error">{error}</Message> : null}
        </div>
      </div>
    </Card>
  )
}
