import { CardsPanel } from '../components/CardsPanel'
import { EmailAccountsPanel } from '../components/EmailAccountsPanel'
import { GmailPanel } from '../components/GmailPanel'
import { RemindersPanel } from '../components/RemindersPanel'
import type { Session } from '../lib/api'

interface ConnectionsPageProps {
  session: Session
  /** Reloads the benefit list after a scan or a card change. */
  onBenefitsChanged: () => void
  onSessionChange: () => void
}

/** Where benefits come from (email accounts, cards) and how Squirrel reminds the user about them. */
export function ConnectionsPage({ session, onBenefitsChanged, onSessionChange }: ConnectionsPageProps) {
  return (
    <div className="grid gap-6">
      <h1 tabIndex={-1} className="text-2xl font-bold tracking-tight outline-none sm:text-3xl">
        Connections
      </h1>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Email sources stacked on the left, so a tall form doesn't leave a gap beside cards. */}
        <div className="grid items-start gap-6">
          <GmailPanel
            googleEnabled={session.google_enabled}
            connection={session.gmail}
            onConnectionChange={onSessionChange}
            onScanFinished={onBenefitsChanged}
          />
          <EmailAccountsPanel onScanFinished={onBenefitsChanged} />
        </div>
        <div className="grid items-start gap-6">
          <CardsPanel onChanged={onBenefitsChanged} />
          <RemindersPanel />
        </div>
      </div>
    </div>
  )
}
