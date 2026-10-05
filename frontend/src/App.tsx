import { useEffect, useRef } from 'react'
import { AcornRain } from './components/acorn/AcornRain'
import { CategoryArtSprite } from './components/CategoryArt'
import { Fireflies } from './components/Fireflies'
import { Header } from './components/Header'
import { Link } from './components/Link'
import { Woodland } from './components/Woodland'
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
  outlook_connected: 'Outlook connected. Scan your mailbox to find benefits.',
  signed_in: 'Signed in with Google.',
}

interface AppProps {
  user: User
  session: Session
  notice: string | null
  /** Why connecting Gmail or Outlook failed, from the redirect back. */
  authError: string | null
  onSessionChange: () => void
  onSignOut: () => Promise<void>
  /** The account was deleted (its session is already gone). */
  onAccountDeleted: () => void
}

export default function App({
  user,
  session,
  notice,
  authError,
  onSessionChange,
  onSignOut,
  onAccountDeleted,
}: AppProps) {
  const toast = useToast()
  // Loaded once here so every page shares the same list and sees each other's edits.
  const { benefits, error, reload, upsert, remove } = useBenefits()
  const path = usePath()
  const page = PAGES.find((p) => p.path === path)

  // One-off message after returning from Google or Microsoft (the ref stops StrictMode showing it twice).
  const noticeShown = useRef(false)
  useEffect(() => {
    if (noticeShown.current) return
    if (authError) toast('error', authError)
    else if (notice && NOTICES[notice]) toast('success', NOTICES[notice])
    else return
    noticeShown.current = true
  }, [notice, authError, toast])

  // On each page change: new tab title, back to the top, and focus on the
  // page heading so screen readers announce the new page.
  const firstRender = useRef(true)
  useEffect(() => {
    document.title = page && page.path !== '/' ? `${page.label} · Squirrel` : 'Squirrel'
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    // A link like "/#review" goes to that section; any other page change starts at the top.
    const section = window.location.hash ? document.getElementById(window.location.hash.slice(1)) : null
    if (section) {
      section.scrollIntoView()
      return
    }
    window.scrollTo(0, 0)
    document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
  }, [page])

  return (
    <>
      <CategoryArtSprite />
      <Woodland />
      <Fireflies />
      <AcornRain />
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to main content
      </a>
      <Header path={path} user={user} onSignOut={onSignOut} onAccountDeleted={onAccountDeleted} />

      <main id="main" className="mx-auto grid max-w-6xl gap-6 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
        {path === '/benefits' ? (
          <BenefitsPage benefits={benefits} error={error} onRetry={reload} onUpdated={upsert} onRemoved={remove} />
        ) : path === '/assistant' ? (
          <AssistantPage benefits={benefits} />
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
