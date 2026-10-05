import { Mail, RefreshCw, Unplug } from 'lucide-react'
import { useEffect, useEffectEvent, useState } from 'react'
import { useArmedAction } from '../hooks/useArmedAction'
import { api, errorMessage, googleUrl, type GmailConnection, type ScanStatus } from '../lib/api'
import { formatDate } from '../lib/format'
import { useToast } from '../lib/toast'
import { SCAN_POLL_MS, ScanProgress, ScanResult } from './ScanStatus'
import { Button } from './ui/Button'
import { Card, CardHeader } from './ui/Card'
import { Message } from './ui/Message'

interface GmailPanelProps {
  googleEnabled: boolean
  connection: GmailConnection | null
  onConnectionChange: () => void
  onScanFinished: () => void
}

export function GmailPanel({ googleEnabled, connection, onConnectionChange, onScanFinished }: GmailPanelProps) {
  const toast = useToast()
  const [scan, setScan] = useState<ScanStatus>({ state: 'idle' })
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [armed, armOrConfirm, disarm] = useArmedAction()
  const running = scan.state === 'running'

  const finished = useEffectEvent((s: ScanStatus) => {
    if (s.state === 'done') onScanFinished()
    // A revoked token disconnects Gmail on the server; refresh to show that.
    if (s.state === 'error') onConnectionChange()
  })

  // Show the latest scan (it may still be running after a page reload).
  useEffect(() => {
    if (!connection) return
    let cancelled = false
    api.gmailStatus().then(
      ({ scan: s }) => !cancelled && setScan(s),
      (e) => !cancelled && setError(errorMessage(e)),
    )
    return () => {
      cancelled = true
    }
  }, [connection])

  // Poll while a scan runs.
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(async () => {
      try {
        const { scan: s } = await api.gmailStatus()
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
      setScan(await api.startScan())
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
      await api.disconnectGmail()
      toast('info', 'Gmail disconnected. Benefits already found are kept.')
      setScan({ state: 'idle' })
      onConnectionChange()
    } catch (e) {
      setError(errorMessage(e))
      disarm()
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <Card as="article" aria-labelledby="gmail-title" className="grid content-start">
      <CardHeader icon={Mail} title="Gmail" titleId="gmail-title" />
      <div className="grid gap-4 p-5">
        {!googleEnabled ? (
          <Message tone="info">
            Gmail isn’t set up on this server yet. Add <code>GOOGLE_CLIENT_ID</code> and{' '}
            <code>GOOGLE_CLIENT_SECRET</code> to <code>.env</code> and restart <code>server.py</code>.
          </Message>
        ) : !connection ? (
          <>
            <p className="text-ink-muted">
              Connect Gmail in one click through Google. For now Google only allows this for invited testers; anyone can
              add Gmail under Email accounts with an app password instead.
            </p>
            <div>
              <Button
                variant="primary"
                icon={<Mail className="size-4" aria-hidden />}
                onClick={() => window.location.assign(googleUrl('connect'))}
              >
                Connect Gmail
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
                Scan inbox
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
