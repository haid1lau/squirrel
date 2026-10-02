import { useEffect, useRef } from 'react'
import { AcornRain } from './components/acorn/AcornRain'
import { CategoryArtSprite } from './components/CategoryArt'
import { Header } from './components/Header'
import { Link } from './components/Link'
import { useBenefits } from './hooks/useBenefits'
import type { Session, User } from './lib/api'
import { PAGES, usePath } from './lib/router'
import { useToast } from './lib/toast'
import { AssistantPage } from './pages/AssistantPage'
import { BenefitsPage } from './pages/BenefitsPage'
import { ConnectionsPage } from './pages/ConnectionsPage'
import { DashboardPage } from './pages/DashboardPage'

const NOTICES: Record<string, string> = {
  gmail_connected: 'Gmail connected. Scan your inbox to find benefits.',
  signed_in: 'Signed in with Google.',
}

interface AppProps {
  user: User
  session: Session
  notice: string | null
  onSessionChange: () => void
  onSignOut: () => Promise<void>
}

export default function App({ user, session, notice, onSessionChange, onSignOut }: AppProps) {
  const toast = useToast()
  // Loaded once here so every page shares the same list and sees each other's edits.
  const { benefits, error, reload, upsert, remove } = useBenefits()
  const path = usePath()
  const page = PAGES.find((p) => p.path === path)

  // One-off message after returning from Google (the ref stops StrictMode showing it twice).
  const noticeShown = useRef(false)
  useEffect(() => {
    if (noticeShown.current || !notice || !NOTICES[notice]) return
    noticeShown.current = true
    toast('success', NOTICES[notice])
  }, [notice, toast])

  // On each page change: new tab title, back to the top, and focus on the
  // page heading so screen readers announce the new page.
  const firstRender = useRef(true)
  useEffect(() => {
    document.title = page && page.path !== '/' ? `${page.label} · Squirrel` : 'Squirrel'
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
  }, [page])

  return (
    <>
      <CategoryArtSprite />
      <AcornRain />
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <Header path={path} email={user.email} onSignOut={onSignOut} />

      <main id="main" className="mx-auto grid max-w-6xl gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        {path === '/benefits' ? (
          <BenefitsPage benefits={benefits} error={error} onRetry={reload} onUpdated={upsert} onRemoved={remove} />
        ) : path === '/assistant' ? (
          <AssistantPage />
        ) : path === '/connections' ? (
          <ConnectionsPage session={session} onBenefitsChanged={reload} onSessionChange={onSessionChange} />
        ) : path === '/' ? (
          <DashboardPage
            user={user}
            benefits={benefits}
            error={error}
            onRetry={reload}
            onConfirmed={upsert}
            onDismissed={remove}
          />
        ) : (
          <div className="grid justify-items-start gap-3 py-10">
            <h1 tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none">
              Page not found
            </h1>
            <Link href="/" className="font-semibold text-primary-text underline-offset-4 hover:underline">
              Go to the dashboard
            </Link>
          </div>
        )}

        <footer className="pt-2 text-center text-sm text-ink-muted">
          Email benefits are read by an AI model (OpenAI); card perks come from a perk list. Dates the AI isn’t sure of
          always go to the review queue.
        </footer>
      </main>
    </>
  )
}
