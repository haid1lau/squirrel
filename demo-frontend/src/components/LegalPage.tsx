import { ArrowLeft } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

// The privacy policy and terms, public at /privacy and /terms (Google's and
// Microsoft's app reviews need them reachable without signing in). Written to
// match what the code does; update them whenever that changes.

const UPDATED = '5 October 2026'
const CONTACT = 'squirrelappsg@gmail.com'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  )
}

const Mail = () => (
  <a href={`mailto:${CONTACT}`} className="font-semibold text-primary-text underline underline-offset-4">
    {CONTACT}
  </a>
)

function Privacy() {
  return (
    <>
      <p>
        Squirrel helps you keep track of vouchers, memberships, points and card credits before they expire. This policy
        explains what Squirrel collects, how it’s used and shared, and how to delete it. Questions: <Mail />.
      </p>

      <Section title="What Squirrel collects">
        <ul className="grid list-disc gap-2 pl-5">
          <li>
            <strong>Your account:</strong> your email address and name, and your password stored as a one-way hash
            (never the password itself). If you sign in with Google, Squirrel receives only your name and email address.
          </li>
          <li>
            <strong>Email you connect</strong> (Gmail, Outlook, or another account with an app password): Squirrel
            searches the last 6 months for emails that mention words like “voucher”, “membership” or “expires”, and
            reads those emails to find benefits. From each one it keeps only what it found: the benefit’s name,
            provider, value, expiry date, any voucher code, a short summary of its terms, a short quote from the email
            showing where the date came from, the email’s subject, and a link back to it. Full emails are not stored. To
            spot hotel and airline memberships, Squirrel also looks at the sender and subject (not the content) of
            emails from those programs over the last 3 years.
          </li>
          <li>
            <strong>Access to your email:</strong> the tokens Google or Microsoft issue, or the app password you enter,
            stored encrypted. Squirrel’s email access is read-only: it can’t send, delete, move or change email, or mark
            it as read.
          </li>
          <li>
            <strong>Things you add:</strong> benefits you type in, the credit cards you choose (the card’s name and
            anniversary month only; Squirrel never asks for card numbers or bank logins), points balances, reminder
            choices, and the questions you ask the assistant with its answers.
          </li>
          <li>
            <strong>Technical details:</strong> a sign-in cookie, your time zone (so reminders arrive at a sensible
            hour), and server logs of which pages were requested. Squirrel has no advertising or analytics trackers.
          </li>
        </ul>
      </Section>

      <Section title="How it’s used">
        <p>
          Only to run Squirrel for you: finding and showing your benefits, sending the reminder emails you set up,
          ranking what needs attention, answering your questions, password reset emails, and keeping the service secure.
          Your data is never sold, used for advertising, or used to build profiles.
        </p>
      </Section>

      <Section title="AI processing (OpenAI)">
        <p>
          To read benefit emails, rank your benefits and answer questions, Squirrel sends the relevant text (the
          matching emails, or your list of benefits and your question) to OpenAI’s API. Under OpenAI’s API terms this
          data isn’t used to train OpenAI’s models, and Squirrel asks OpenAI not to store the responses. OpenAI may keep
          API data for a limited time to detect abuse, as its policies describe.
        </p>
      </Section>

      <Section title="Google user data">
        <p>
          If you connect Gmail, Squirrel uses Google’s read-only Gmail access only to find benefit emails and show you
          what it finds. Squirrel’s use and transfer of information received from Google APIs to any other app will
          adhere to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary-text underline underline-offset-4"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. In particular:
        </p>
        <ul className="grid list-disc gap-2 pl-5">
          <li>Gmail data is used only to provide Squirrel’s features that you can see and use.</li>
          <li>
            It’s transferred to others only as needed to provide those features (to OpenAI, as above), to comply with
            the law, or as part of a merger or sale with your notice.
          </li>
          <li>
            It’s never used for advertising, never sold, and never used to train general AI or machine learning models.
          </li>
          <li>
            No person reads your email, except with your permission, where needed for security (such as investigating
            abuse), to comply with the law, or in aggregated and anonymised form for running the service.
          </li>
        </ul>
        <p>Data from Microsoft (Outlook) and from app-password accounts is handled in exactly the same way.</p>
      </Section>

      <Section title="Who else handles your data">
        <ul className="grid list-disc gap-2 pl-5">
          <li>OpenAI, for the AI processing above.</li>
          <li>Google and Microsoft, which you sign in with, and your email provider, which Squirrel reads from.</li>
          <li>The email service that delivers Squirrel’s reminders and password reset emails.</li>
          <li>The company that hosts Squirrel’s server.</li>
          <li>Authorities, if the law requires it.</li>
        </ul>
      </Section>

      <Section title="Security">
        <p>
          Email access tokens and app passwords are encrypted, passwords are hashed, and connections to Squirrel use
          HTTPS. No system is perfectly secure; if a breach affects your data, you’ll be told.
        </p>
      </Section>

      <Section title="Keeping and deleting your data">
        <ul className="grid list-disc gap-2 pl-5">
          <li>Your data is kept while you have an account.</li>
          <li>
            <strong>Disconnecting an email account</strong> (on the Connections page) deletes Squirrel’s access to it
            straight away. Benefits already found stay until you remove them.
          </li>
          <li>
            <strong>Deleting your account</strong> (account menu → Delete account) permanently deletes everything
            Squirrel holds for you straight away, and revokes Gmail access at Google. If backups exist, deleted data is
            removed from them within 30 days.
          </li>
          <li>
            You can also remove Squirrel’s access at any time from your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary-text underline underline-offset-4"
            >
              Google account
            </a>{' '}
            or{' '}
            <a
              href="https://account.live.com/consent/Manage"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary-text underline underline-offset-4"
            >
              Microsoft account
            </a>
            , or by deleting the app password at your email provider.
          </li>
        </ul>
      </Section>

      <Section title="Your choices and rights">
        <p>
          You can see and edit your benefits in the app, and delete your account at any time. To ask for a copy of your
          data, a correction, or anything else about your privacy, email <Mail />.
        </p>
      </Section>

      <Section title="Children">
        <p>Squirrel isn’t meant for anyone under 13, and doesn’t knowingly collect their data.</p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes, the date below changes too, and important changes will be announced in the app or by
          email before they take effect.
        </p>
      </Section>
    </>
  )
}

function Terms() {
  return (
    <>
      <p>
        These terms cover your use of Squirrel. By creating an account or using Squirrel, you agree to them and to the{' '}
        <a href="/privacy" className="font-semibold text-primary-text underline underline-offset-4">
          privacy policy
        </a>
        . Questions: <Mail />.
      </p>

      <Section title="The service">
        <p>
          Squirrel finds benefits in the email accounts you connect and the cards you add, and reminds you before they
          expire. It’s offered free of charge, as is, and may change or stop at any time.
        </p>
      </Section>

      <Section title="Check important dates yourself">
        <p>
          Squirrel uses AI to read emails, and card perks come from a list that may be out of date. Benefits, values,
          codes and expiry dates can be missed or wrong, and reminders can fail to arrive. Always check the original
          email or the provider’s terms before relying on a date. Squirrel isn’t responsible for a benefit that expires
          or is lost.
        </p>
      </Section>

      <Section title="Your account">
        <ul className="grid list-disc gap-2 pl-5">
          <li>You must be at least 13, and give an email address you control.</li>
          <li>Connect only email accounts that are yours, and keep your password safe.</li>
          <li>You can delete your account at any time from the account menu.</li>
        </ul>
      </Section>

      <Section title="Fair use">
        <p>
          Don’t misuse Squirrel: no attempts to break in, overload it, get around its limits, reach other people’s data,
          or use it for anything unlawful. Accounts that do may be suspended or deleted.
        </p>
      </Section>

      <Section title="Responsibility">
        <p>
          To the extent the law allows, Squirrel is provided without warranties of any kind, and isn’t liable for
          indirect or consequential losses, or for lost benefits, points or money. Nothing in these terms limits rights
          you have by law that can’t be limited.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          These terms may be updated; the date below shows when. Important changes will be announced in the app or by
          email before they take effect, and continuing to use Squirrel afterwards means you accept them.
        </p>
      </Section>

      <Section title="Law">
        <p>These terms are governed by the laws of Singapore.</p>
      </Section>
    </>
  )
}

export function LegalPage({ page }: { page: 'privacy' | 'terms' }) {
  const title = page === 'privacy' ? 'Privacy policy' : 'Terms of service'
  useEffect(() => {
    document.title = `${title} · Squirrel`
  }, [title])

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="/" className="flex min-h-11 items-center gap-2.5 rounded-lg font-bold tracking-tight">
            <img src="/icon-192.png" alt="" width={32} height={32} className="size-8 rounded-[9px]" />
            Squirrel
          </a>
          <a
            href={page === 'privacy' ? '/terms' : '/privacy'}
            className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {page === 'privacy' ? 'Terms of service' : 'Privacy policy'}
          </a>
        </div>
      </header>
      <main className="mx-auto grid max-w-3xl gap-8 px-4 pt-10 pb-20 leading-relaxed sm:px-6">
        <div className="grid gap-2">
          <a
            href="/"
            className="inline-flex min-h-11 items-center gap-1.5 justify-self-start text-sm font-semibold text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to Squirrel
          </a>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <p className="text-sm text-ink-muted">Last updated {UPDATED}</p>
        </div>
        {page === 'privacy' ? <Privacy /> : <Terms />}
      </main>
    </div>
  )
}
