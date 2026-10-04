import { LoaderCircle, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import App from './App'
import { Landing } from './components/landing/Landing'
import { ResetPasswordScreen } from './components/ResetPasswordScreen'
import { Button } from './components/ui/Button'
import { Message } from './components/ui/Message'
import { api, errorMessage, setUnauthorizedHandler, type Session } from './lib/api'
import { usePath } from './lib/router'

/** Reads ?notice= / ?auth_error= left by the Google redirect, then removes them from the URL. */
function takeRedirectParams() {
  const params = new URLSearchParams(window.location.search)
  const result = {
    notice: params.get('notice'),
    authError: params.get('auth_error'),
  }
  if (result.notice || result.authError) {
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  }
  return result
}

/** Loads the session and shows either the sign-in screen or the dashboard. */
export function Root() {
  const [redirect] = useState(takeRedirectParams)
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const path = usePath()

  const fetchSession = useCallback(() => {
    api.session().then(
      (s) => {
        setSession(s)
        setError(null)
        // Reminders are sent by the user's own clock, so tell the server where they are.
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (s.user && timezone) api.setTimezone(timezone).catch(() => {})
      },
      (e) => setError(errorMessage(e)),
    )
  }, [])
  const load = useCallback(() => {
    setError(null)
    fetchSession()
  }, [fetchSession])

  useEffect(() => {
    fetchSession()
    setUnauthorizedHandler(() => setSession((s) => s && { ...s, user: null, gmail: null }))
    return () => setUnauthorizedHandler(null)
  }, [fetchSession])

  async function signOut() {
    try {
      await api.logout()
    } finally {
      setSession((s) => s && { ...s, user: null, gmail: null })
    }
  }

  // Opened from a reset email: shown whether or not someone is signed in here.
  if (path === '/reset-password') {
    return <ResetPasswordScreen onSignedIn={load} />
  }

  if (error) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-md content-center gap-3 px-4">
        <Message tone="error">{error}</Message>
        <div>
          <Button icon={<RefreshCw className="size-4" aria-hidden />} onClick={load}>
            Try again
          </Button>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="grid min-h-dvh place-items-center" aria-busy="true">
        <LoaderCircle className="size-6 animate-spin text-ink-muted" aria-label="Loading" />
      </main>
    )
  }

  if (!session.user) {
    return <Landing googleEnabled={session.google_enabled} initialError={redirect.authError} onSignedIn={load} />
  }

  return (
    <App
      // A different account gets a fresh dashboard, not the last one's state.
      key={session.user.id}
      user={session.user}
      session={session}
      notice={redirect.notice}
      onSessionChange={load}
      onSignOut={signOut}
    />
  )
}
