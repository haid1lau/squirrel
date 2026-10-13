import { CircleCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { navigate } from '../lib/router'
import { Button } from './ui/Button'
import { Card } from './ui/Card'
import { Message } from './ui/Message'

/** Reads the token from the emailed link (#token=...), then removes it from the address bar. */
function takeToken() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
  if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  return token
}

/** Opened from the confirmation email: confirms the address, signed in or not. */
export function VerifyEmailScreen({ onDone }: { onDone: () => void }) {
  const [token] = useState(takeToken)
  const [result, setResult] = useState<{ ok: true; email: string } | { ok: false; error: string } | null>(
    token ? null : { ok: false, error: 'This link is incomplete. Open the link from the email again.' },
  )
  const started = useRef(false) // StrictMode runs effects twice; a link works only once

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    api.verifyEmail(token).then(
      ({ user }) => setResult({ ok: true, email: user.email }),
      (e) => setResult({ ok: false, error: errorMessage(e) }),
    )
  }, [token])

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 py-10">
      <div className="grid justify-items-center gap-3 text-center">
        <img src="/icon-192.png" alt="" width={48} height={48} className="size-12" />
        <h1 className="text-2xl font-bold tracking-tight">
          {result?.ok ? 'Email confirmed' : result ? 'Couldn’t confirm your email' : 'Confirming your email…'}
        </h1>
      </div>
      <Card className="grid gap-5 p-6" aria-live="polite">
        {result?.ok ? (
          <p className="flex items-start gap-2">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
            <span>
              Thanks! <strong className="[overflow-wrap:anywhere]">{result.email}</strong> is confirmed, so Squirrel can
              now email you before your benefits expire.
            </span>
          </p>
        ) : result ? (
          <Message tone="error">{result.error}</Message>
        ) : (
          <p className="text-ink-muted">One moment…</p>
        )}
        <div>
          <Button
            variant="primary"
            disabled={!result}
            onClick={() => {
              navigate('/')
              onDone()
            }}
          >
            Go to Squirrel
          </Button>
        </div>
      </Card>
    </main>
  )
}
