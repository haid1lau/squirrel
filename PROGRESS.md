# Squirrel: progress notes

_Last updated: 2 October 2026_

_Renamed from BenefitApp to Squirrel on 1 October 2026. Internal names keep the old one on purpose: the database `instance/benefitapp.db`, the `BENEFITAPP_SECRET_KEY` setting and the `benefitapp_session` / `benefitapp_oauth_state` cookies. Renaming them would make existing data unreadable or sign everyone out. The project folder is still `BenefitApp/`._

Squirrel tracks memberships, vouchers and card perks so they don't expire unnoticed. Users sign in (email + password, or Google), then:

- **Connect Gmail** (read-only), or **other email over IMAP** (Yahoo, iCloud, AOL, …) with an app password. The app searches for likely benefit emails, and an OpenAI model extracts each benefit; plain code checks the result.
- **Add credit cards** from a list. Each card's recurring credits are tracked with the date they reset. No card numbers or bank connection.
- **Get email reminders** before benefits expire, timed per user, per category and per benefit, in the user's own time zone.

Anything with an uncertain expiry date goes to a review queue instead of being trusted.

---

## ⚠️ Before anything else

1. **Set `OPENAI_API_KEY` in `.env`.** It's still empty, so the AI features (Gmail scanning, digest, assistant) have **never been run against the real API**. They've only been tested with the API mocked. The model defaults to `gpt-5.5`; set `OPENAI_MODEL` to change it.
2. **Google OAuth client: done** (30 September 2026). `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are in `.env`. The secret was rotated and the new one checked against Google (1 October); the Gmail API is enabled; the owner renamed the app to Squirrel under Branding and believes the old secret is deleted (2 October). **Still to do:** confirm the Clients page lists only one secret, and try Google sign-in + Connect Gmail end to end in the browser (the consent screen should say "to continue to Squirrel").
3. **Email (SMTP): done.** Password resets and reminders come from `Squirrel Support <squirrelappsg@gmail.com>` (Gmail app password in `.env`). Delivery confirmed for reset emails and a sample reminder (2 October).

`server.py` loads `.env` on start, so restart it after changing `.env`.

### Google sign-in and Gmail: one-time setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. **APIs & Services → Library:** enable the **Gmail API**.
3. **Google Auth Platform → Branding:** fill in the app name and your email. **Audience:** choose **External** and leave it in **Testing**. Add yourself and each tester under **Test users** (up to 100).
4. **Data access:** add the scopes `openid`, `email`, `profile` and `https://www.googleapis.com/auth/gmail.readonly`.
5. **Clients → Create client → Web application.** Authorised redirect URI: `http://127.0.0.1:8000/api/auth/google/callback`.
6. Copy the client ID and secret into `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart `server.py`.

Always open the app at `http://127.0.0.1:8000` (not `localhost`), so the sign-in cookie and the redirect URI match.

**Public launch warning:** `gmail.readonly` is a Google *restricted* scope. In Testing mode it works for listed test users only, and Google expires their Gmail access after 7 days, so testers must reconnect Gmail weekly (the app detects this and asks them to reconnect). Opening it to the public requires Google's verification and a yearly third-party security assessment.

### Owner decisions (30 September 2026)
- **Live points balances from loyalty programs: not now** (1 October 2026). AwardWallet's API was ruled out (users need AwardWallet accounts, pricing isn't public, it needs a fixed-IP server). **Future option:** Singapore Airlines' developer portal has a KrisFlyer *Get Customer Details* API with the live miles balance, a free sandbox and a KrisFlyer partnership track; Accor's portal has partner loyalty APIs (earn, burn, account linking) but no public balance lookup. Both need a commercial partnership and a hosted app with terms and a privacy policy.
- **Other email providers: IMAP first (done), Outlook later.** ⏰ **Reminder: add Outlook / Hotmail / Microsoft 365** through Microsoft's own sign-in (Microsoft Graph, read-only mail access). It needs a free app registration in the Azure portal, with its ID and secret in `.env`. IMAP can't cover Outlook: Microsoft switched off app-password sign-in.
- **Benefit fields** (1–2 October 2026): **Type** is Membership, Subscription, Voucher or Other (Travel, Health and Retail were dropped). **Category** is Entertainment, Transport, Travel, Dining, Wellness, Shopping or Others.
- **Reminders** (2 October 2026): by email, on for new accounts at 1 week before; users can set it per category and per benefit. Settings live on the Connections page.
- **No "import an email" option.** Don't build `.eml` upload or paste-an-email import; benefits come from connected inboxes, cards, or typing a benefit in by hand.

---

## How to run

```bash
cd frontend && npm run build && cd ..   # rebuild the React app after frontend changes
/opt/anaconda3/bin/python3 server.py    # then open http://127.0.0.1:8000
```

- **Frontend development:** run `npm run dev` in `frontend/` for live reload. It forwards `/api` requests to `server.py`, which must also be running.
- **Reset all data:** stop the server and delete `instance/` (database and the key that encrypts Gmail tokens). Users will need to sign up again.
- **Frontend dev and Google:** after Google sign-in you land on the built app at `:8000`, not the Vite dev server. Password sign-in works on both.
- `benefits.json` is from the old paste-an-email version and is **no longer used**. Safe to delete.
- **Restart after backend changes.** The server doesn't reload code; an old server keeps serving old code while the frontend is rebuilt (this caused a blank app once). Stop it with `lsof -ti:8000 | xargs kill`.
- **Python:** use Anaconda Python (`/opt/anaconda3/bin/python3`), which has `cryptography`. Plain `python3` in some shells is a python.org 3.13 without it. The OpenAI calls use `urllib`, so no `openai` package is needed.
- **Node:** v26 via Homebrew (`brew install node`).

---

## Project structure

| Path | What it is |
|---|---|
| `config.py` | Settings from environment / `.env` (OpenAI key and model, Google client, app URL). |
| `db.py` | SQLite storage in `instance/benefitapp.db`, plus encryption (Fernet) for Gmail refresh tokens. |
| `auth.py` | Accounts (scrypt password hashes), Google-account linking, cookie sessions, wrong-password throttling, password reset links. |
| `mailer.py` | Sends the app's own emails (reset links, reminders) over SMTP; prints them in the terminal when SMTP isn't set up. |
| `reminders.py` | Emails users before benefits expire: settings, which reminders are due, the email, and the 15-minute background check. |
| `google_api.py` | Google OAuth (PKCE) and the Gmail API calls, using `urllib` only. |
| `scan_jobs.py` | Shared by every inbox scan: search keywords and limits, background jobs, and the extract → store step. |
| `gmail_sync.py` | Gmail scan: Gmail search → `scan_jobs`. Up to 50 new emails per scan. |
| `imap_sync.py` | Other email over IMAP (TLS, port 993, app password): server lookup by domain, read-only inbox search → `scan_jobs`. |
| `mailtext.py` | HTML email → plain text, for both readers. |
| `loyalty.py` | Loyalty program list (sender domains, points-expiry rules) and membership detection from who emails the user. No AI. |
| `cards.py` | Credit-card perk catalog and reset-date maths. |
| `app.py` | Core AI engine: the OpenAI Responses API client (`call_structured`, `call_text`, retries, error messages), and extraction of one benefit from email text, checked with plain code (`validate`). |
| `BenefitIntelligence.py` | Weekly digest (urgency ranking) and a Q&A assistant that answers only from the user's own benefits. |
| `server.py` | Standard-library web server. JSON API under `/api/*`, and serves the React build from `frontend/dist`. |
| `frontend/` | React 19 + TypeScript + Vite + Tailwind v4. `Root.tsx` shows sign-in or the app; `App.tsx` picks the page; pages are in `src/pages/` (Dashboard, All benefits, Assistant); `lib/router.ts` is a small History API router. |
| `.env.example` | Template for `.env`. |
| `instance/` | Created at runtime: database and encryption key. **Never commit or share.** |

### API endpoints (`server.py`)

All except `/api/session` and the `/api/auth/*` routes need a signed-in session. POSTs must be JSON, and must come from the app's own origin.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/session` | Current user, whether Google is set up, Gmail connection |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | Email + password |
| POST | `/api/auth/forgot` (body: `email`), `/api/auth/reset` (body: `token`, `password`) | Password reset by emailed link |
| GET/POST | `/api/reminders` (POST body: `enabled`, `days_before`, optional `categories`) | The account's reminder settings |
| POST | `/api/timezone` (body: `timezone`, e.g. `Asia/Singapore`) | Sent by the browser on every load; reminders follow it |
| GET | `/api/auth/google/start?purpose=login\|connect` | Browser redirect to Google |
| GET | `/api/auth/google/callback` | Google redirects back here |
| GET | `/api/benefits` | User's active benefits (card perks refreshed for the current period) |
| POST | `/api/benefits/<id>/approve`, `/dismiss` | Review queue. Dismissed items are kept hidden so scans don't re-add them. `dismiss` is also "Remove", and "Hide until it resets" for card perks. |
| POST | `/api/benefits` | Add a benefit by hand (`source: manual`). Same fields and checks as `update`, including an optional whole-number `points` balance instead of `value`. |
| POST | `/api/benefits/<id>/update` | Edit name, provider, category, value, expiry date, terms. Also clears the review flag. |
| POST | `/api/benefits/<id>/quick` | One-tap changes from a benefit's card, any of: `used` (true/false), `used_amount` (card credits: dollars spent this period, 0 to the credit's amount), `points`, `reminder`. Undo sends the old values back. |
| GET | `/api/gmail/status` | Connection + latest scan progress |
| POST | `/api/gmail/scan` | Starts a background scan (**calls OpenAI**) |
| POST | `/api/gmail/disconnect` | Revokes Google access and deletes the stored token |
| GET | `/api/imap` | Connected IMAP accounts, each with its latest scan status |
| POST | `/api/imap` (body: `email`, `password`, optional `host`) | Checks the sign-in, then saves the account (password encrypted) |
| POST | `/api/imap/<id>/scan`, `/api/imap/<id>/remove` | Scan (**calls OpenAI**); disconnect (benefits found are kept) |
| GET | `/api/cards` | User's cards + catalog |
| POST | `/api/cards` (body: `card_key`, `anniversary_month`), `/api/cards/<id>/remove` | |
| GET | `/api/digest` | **Calls OpenAI** |
| POST | `/api/ask` | **Calls OpenAI**. Saves the question and answer to the history. |
| GET | `/api/ask/history` | Last 50 questions and answers, newest first |
| POST | `/api/ask/history/clear` | |

Page URLs `/`, `/benefits` and `/assistant` all serve the React app.

---

## What has been done

### 1. `app.py`: fixes to the extraction engine
- **Model:** switched to `claude-sonnet-5-5`. Sonnet 5.5 rejects forced `tool_choice`, so extraction now uses **structured outputs** (`output_config.format` with a JSON schema).
- **Shared helper:** added `call_structured()`, used by every AI feature. It handles refusals, output cut off at `max_tokens`, and JSON parsing.
- **Fallback:** enabled server-side refusal fallback (`fallbacks="default"`, beta `server-side-fallback-2026-07-01`).
- **`max_tokens`:** raised to 16,000 (thinking is always on for this model). Effort is set to `medium`.
- **Import:** the client is created lazily, so importing the module no longer needs an API key.
- **Today's date:** now sent to the model, so relative wording like "valid for 6 months" can be worked out.
- **Validation fixes:**
  - An `explicit` or `computed` confidence with no date is now flagged.
  - Every flagged record gets a `review_reason`.
  - Unexpected fields from the model are ignored.
  - The model can't set `needs_review` itself.
- **Batch processing:** one failed email no longer stops the batch. Failures go into an `errors` list.
- **Demo email:** updated so its computed date lands in the future.

### 2. `BenefitIntelligence.py`: built on the code you started
- **Import fix:** it imported from `benefit_extraction`, which doesn't exist. It now imports from `app`.
- **Renamed** from `BenefitInterlligence.py` (typo).
- **Digest:**
  - Now uses structured outputs, and the model refers to benefits by ID.
  - Code drops IDs the model made up or repeated, and uses the real names from your records.
  - Dates of benefits waiting for review are withheld from the model.
  - Days until expiry are worked out in code.
- **Q&A search:** matches whole words and skips common words. The old substring matching let "a" match almost everything.
- **Empty lists:** both functions return a short message without calling the API.

### 3. `server.py`: new
- **Endpoints:** the JSON API above, with clear error messages for a missing key, rate limits, connection failures and API errors.
- **Missing-key bug fixed:** with no key, the SDK raises a plain `TypeError`, which previously produced an empty response.
- **Catch-all:** any unexpected error returns a JSON error instead of a blank reply.
- **Safe file serving:** serves `frontend/dist` and refuses any path outside it. This was tested.
- **Caching:** hashed asset files are cached for a year; `index.html` is never cached.
- **Network and input limits:** binds to `127.0.0.1` only, and request bodies are limited to 64 KB.

### 4. Design skill
- **Installed** UI/UX Pro Max into `.claude/skills/ui-ux-pro-max/`. The `npx claude-code-templates` installer failed because the GitHub API rate limit was used up, so the folder was fetched with a git sparse checkout. Its scripts were reviewed first: standard library only, no network access.
- **Read all 28 skill files.**
- **First design run was misclassified:** it matched "Portfolio/Personal" because the query said "personal".
- **Corrected run:** matched **Productivity Tool**:
  - flat design with quick micro-interactions
  - blue `#3B82F6` as the main colour
  - orange CTA, darkened to `#C2410C` so white button text meets 4.5:1 contrast
  - Plus Jakarta Sans throughout

### 5. React frontend: new
- **Stack:** Vite + React 19 + strict TypeScript + Tailwind v4, with light and dark mode following the system setting.
- **Sections:**
  - summary counts
  - "Expiring soonest" list with days-left badges and bars
  - weekly digest
  - review queue (confirm a date, or dismiss with two clicks)
  - Add from an email
  - Ask about your benefits
- **Skill rules applied:**
  - skip link, visible labels, inline errors announced by screen readers
  - visible focus, 44px tap targets
  - spinners on busy buttons; loading placeholders; helpful empty states; notices that disappear after 4 seconds
  - "AI-generated" labels on Claude's output
  - keyboard shortcuts (`/` → Ask, `A` → Add email)
  - error boundary, reduced-motion support, dates formatted for your locale
- **Checked with** headless-Chrome screenshots in light mode, dark mode and at 375px width. The linter (oxlint) is clean.
- **Bugs fixed during testing:**
  - rows were invisible on phones because of a fade-in animation
  - the nav highlighted the wrong section on tall screens
  - the header button pushed nav links off screen on phones
- **Removed** the old single-file `static/index.html`.

---

### 6. Accounts, Gmail and credit cards (30 September 2026)
Replaced "paste an email" with connected sources:
- **Accounts:** email + password (scrypt, min 10 characters, throttled after 5 wrong tries) and "Continue with Google". A Google sign-in links to an existing account with the same email only if Google has verified it.
- **Sessions:** random token in an HttpOnly, SameSite=Lax cookie; only its hash is stored. Cross-site requests are blocked (JSON-only POSTs plus an Origin check).
- **Google OAuth:** PKCE, a single-use state that expires after 10 minutes and is tied to the browser by a cookie, and ID token issuer/audience/expiry checks.
- **Gmail:** Google sign-in asks for Gmail read access in the same step. Password users get a "Connect Gmail" button. Refresh tokens are encrypted at rest. Scans run in the background with a progress bar. Each email is read by Claude once; failed ones are retried on the next scan. A missing API key or a revoked Google grant stops the scan with a clear message.
- **Cards:** catalog of 5 US cards (Amex Platinum and Gold, Chase Sapphire Reserve and Preferred, Capital One Venture X). Perks cover monthly, quarterly, half-yearly, calendar-year and card-anniversary resets. Anniversary perks are dated the month before the anniversary month, so reminders come early.
- **Frontend:** sign-in / create-account screen, sign-out in the header, and a new **Connections** section (Gmail + Credit cards) in place of "Add from an email". Gmail benefits link back to the email.
- **Removed:** the paste form, `/api/extract` and the `benefits.json` demo store. Each user now starts empty.
- **Tested offline** with Google and Claude mocked. The throwaway scripts were not saved. They covered sign-up, login, throttling, per-user isolation, cross-site blocking, the OAuth state checks, the scan flow and the period maths. Also checked: headless-Chrome screenshots (desktop, and phone width via an iframe) and a clean lint and build.

### 7. OpenAI instead of Claude, and two new pages (30 September 2026)
- **AI provider:** all AI calls now go to the **OpenAI Responses API** (`gpt-5.5` by default, `OPENAI_MODEL` to change). The Anthropic code and the `anthropic` dependency are gone.
  - Uses Python's `urllib`, like `google_api.py`; nothing new to install.
  - Structured outputs use strict JSON schemas; both existing schemas already met the strict rules.
  - `store: false`, so OpenAI doesn't keep responses (the input is personal email).
  - Retries rate limits, 5xx and connection errors up to 3 times, respecting `retry-after`.
  - Clear messages for no key, bad key, out of credit, rate limit, unavailable model and no connection. Scans stop on any of those instead of failing every email.
  - Refusals and cut-off output become `ExtractionError`, as before.
  - Tested offline with the API mocked (every case above, plus the digest's check that drops invented IDs).
- **Pages:** the single scrolling page is now three pages with real URLs (back/forward and new-tab links work):
  - **Dashboard** (`/`): summary counts, the 5 soonest-expiring benefits with a link to the full list, review queue, connections.
  - **All benefits** (`/benefits`): search (`/` to focus), filters for category, source and status, and sorting. Each benefit can be **edited**; Gmail benefits can be **removed**; card perks can be **marked as used**, which hides them until the credit resets. The last two need a second click to confirm.
  - **Assistant** (`/assistant`): Ask, with a saved **history** of questions and answers (last 50 per user, can be cleared), and the weekly digest.
  - Each page sets the tab title and moves focus to its heading for screen readers. Shorter nav labels on phones.
- **Checked:** type check, build and oxlint clean; API tests with `curl` (edit validation, history trimming, cross-site blocking); signed-in headless-Chrome screenshots of every page, including the edit form and a 375px-wide phone. No console errors. The test account was deleted afterwards.

### 8. Adding benefits by hand, and the demo account (30 September 2026)
- **All Benefits** (heading and nav now capitalised) has an **Add a benefit** button for things not in Gmail or a card, like a paper gift card. They show as "Added by you", have their own Source filter, and can be edited or removed. They're included in the digest and the assistant.
- **`demo_seed.py`** creates or resets `demo@example.com` / `demo-benefits-2026`, with fictional Gmail benefits (3 in review), an Amex Platinum card, one hand-added benefit, a fake Gmail connection and two hand-written assistant answers. `--delete` removes it.

### 9. Other email over IMAP (30 September 2026)
- **Dashboard → Connections → Other email:** enter an address and an **app password** (the panel links to where Yahoo, iCloud and AOL create them). The server is found automatically for Yahoo, iCloud, AOL, Fastmail, Zoho, GMX, mail.com and Yandex; for anything else the user types the IMAP server. Several addresses can be connected.
- **Safety:** TLS only (port 993); the sign-in is tested before anything is saved; the inbox is opened **read-only** and emails are fetched with `BODY.PEEK`, so nothing is marked as read. App passwords are encrypted like Gmail tokens. A typed-in server must be a public host (no `localhost` or private addresses). Outlook/Hotmail and Gmail addresses are turned away with a pointer to the right option.
- **Same pipeline as Gmail:** the scan loop was moved into `scan_jobs.py`, so both use the same keywords, 6-month window, per-scan limit (now 50), AI extraction and review queue. Benefits show as "From you@yahoo.com", with an "Other email" source filter.
- **Gmail errors fixed:** a disabled Gmail API is now reported as such, instead of "access revoked" (which also deleted the connection).
- **Tested offline** with a fake IMAP server and fake AI: server lookup, the search command, email parsing (plain, HTML-only, broken), wrong password, duplicates, a 20-email inbox over two scans, disconnecting, and the Gmail scan after the refactor. Browser-checked the panel and its errors. **Not yet tried against a real provider.**

### 10. Loyalty memberships found from who emails you, and points (1 October 2026)
- **Detection (no AI, works without the OpenAI key):** every Gmail and IMAP scan first checks 13 programs in `loyalty.py`: Marriott Bonvoy, Hilton Honors, World of Hyatt, IHG One Rewards, ALL Accor Live Limitless, Wyndham Rewards, AAdvantage, Singapore Airlines KrisFlyer, British Airways Club, Delta SkyMiles, United MileagePlus, Southwest Rapid Rewards, JetBlue TrueBlue.
  - KrisFlyer miles expire a fixed 36 months after they're earned (not after inactivity), so for KrisFlyer the app shows the rule and asks for the date instead of estimating it. Accor and KrisFlyer sending domains are best guesses (`accor.com`, `accorhotels.com`, `singaporeair.com`, `singaporeair.com.sg`); add any others they really use.
  - It looks back 3 years for any email from the program's domains, reading **only the sender, subject and date**. The sender's domain is checked exactly, so lookalikes like `saa.com` or `hilton.com.evil.net` don't count.
  - The newest email whose subject looks like activity (confirmation, receipt, folio, itinerary, "thanks for staying", points earned, …) dates the last activity. Plus the program's inactivity rule (e.g. 24 months for Marriott), that gives an **estimated expiry**. Programs whose points don't expire say so; with promo emails only, the user is asked for the date.
  - Detections land in the **review queue** (source `loyalty`, "Membership found in your email"), showing how the date was worked out. Rescans refresh a detection only while it's unconfirmed; a dismissed one never returns. The scan result reports memberships found, even if the AI step then fails.
- **Points:** benefits have an optional `points` balance. The Add/Edit form has a **Value / Points** choice (memberships default to Points), and lists show "48,250 points". Points go to the digest too.
- **Demo:** `demo_seed.py` adds a detected Marriott membership (estimated date) and Delta (no expiry).
- **Tested** offline with fake Gmail/IMAP inboxes (detection, lookalike senders, dated and undated activity, rescans, dismissals) and in the browser (review queue, confirming, adding with points). Not yet run against a real inbox.
- **Limits:** activity is guessed from subject lines, so a promo titled like a receipt could shift the estimate (the user confirms every date). Only the programs listed are detected; rules and domains were written from knowledge as of mid-2025 and need checking.

### 11. Forgot password and bigger scans (1 October 2026)

- **Forgot password:** "Forgot password?" on the sign-in screen asks for an email and sends a one-time link (`/reset-password#token=…`) that works for 1 hour. The token sits after `#`, so it never reaches server logs; only its SHA-256 is stored. Choosing a new password signs out every other session and signs the user in. The form answers the same whether or not the account exists, the email is sent in the background (so timing doesn't reveal it either), and each address gets at most 3 links an hour. Google-only accounts can use it to add a password.
- **Sending email:** `mailer.py` uses the `SMTP_*` / `MAIL_FROM` settings in `.env` (see `.env.example`). **Until they're set, the reset email is printed in the server terminal**, and the form says so. Fine locally; set up SMTP before anyone else uses the app.
- **Bigger scans:** "Scan inbox" now reads up to **50** new emails per press (was 15; briefly 100, lowered by the owner to save tokens), with **5 read by the AI model at once** (`scan_jobs.extract_all`, `AI_WORKERS`). Emails are still fetched one at a time on the scan thread (an IMAP connection can't be shared). A fatal error such as a missing API key stops the scan early. Cost per scan is up to ~3× higher than at 15; change `MAX_EMAILS_PER_SCAN` in `scan_jobs.py` if needed.
- **Tested:** the reset flow end to end (unknown email, short password, reused link, old session signed out, old password rejected, rate limit) and in the browser; parallel extraction with a fake AI model (30 emails, 5 at once, correct counts, stops on a fatal error). **Not yet tried with real SMTP or a real 50-email scan.**

### 12. Type and category (1 October 2026)

- What used to be "Category" is now **Type**: Membership, Subscription, Voucher or Other. Travel, Health and
  Retail were dropped since the categories cover them; existing ones became a membership (points, miles, plans)
  or a voucher (credits, certificates, discounts), and card credits are vouchers.
- The new **Category** is what a benefit is spent on: Entertainment, Transport, Travel, Dining, Wellness, Shopping
  or Others. The AI picks it for new emails, each card perk has one, and the All Benefits page filters by both.
- Benefits saved before this got their category guessed from their name, provider and terms when the server
  started (`_add_benefit_types` in db.py, runs once per row). Fix any wrong guess with Edit.

- **App icon:** the original is `design/app-icon.jpg`. `frontend/public/` holds the sizes made from it (corners
  cut transparent): `favicon.png`, `icon-192.png` (also the logo in the header and sign-in screens), `icon-512.png`,
  `apple-touch-icon.png` (corners filled blue for iOS) and `manifest.webmanifest`. To change the icon, regenerate
  these from a new square image.

### 13. Expiry reminders by email (2 October 2026)

- **Reminders card** (now on the Connections page): on or off, "Usually remind me" (on the day, 1, 2 or 3 days, 1 or 2
  weeks, 1, 2, 3 or 6 months before), and **By category**: a different choice, or none, per category (say travel
  6 months, dining 1 month). Precedence: the benefit's own choice, then its category's, then the usual one. New accounts start on, 1 week before. The demo account has them off, since
  example.com isn't a real inbox.
- **Per benefit:** "Remind me" in the Add/Edit form overrides the usual setting or turns it off for that benefit
  (stored as `reminder` in the benefit's data). The row shows "No reminder" or "Reminder 3 days before" when set.
- **Time zones:** the browser reports its time zone (`Intl`) to `/api/timezone` each time the app loads, stored in
  `reminder_settings.timezone`. "Today" and the 8am start follow it; until it's known, the server's zone is used.
  The card says "after 8am Singapore time". Someone who travels gets the zone of the last device they opened.
- **Sending:** `server.py` starts a background thread that checks every 15 minutes, from 8am the user's time. Each
  user gets one email listing everything whose reminder day has come; each benefit is reminded once per expiry
  date (`reminders_sent`). Benefits waiting for review are skipped. The email links to `/benefits` and
  `/connections#reminders` using `APP_URL`, so set that in `.env` when the app is deployed (see Next steps).
- **Limits:** reminders only go out while `server.py` is running; one missed while it was off goes out at the next
  check, unless the benefit has expired by then.
- **Tested:** the rules (default, per-benefit override and off, already sent, expired, needs review, before 8am),
  the API, and the UI in light/dark and at phone width. A sample reminder (demo benefits, travel 6 months / dining 1 month) was delivered to the owner's inbox on 2 October; dates in a later year now show the year. **Not yet watched: the background thread sending one on its own** (Next steps).

### 14. Connections page (2 October 2026)

- Gmail, Other email, Credit cards and Reminders moved off the dashboard to their own page, `/connections`
  (`ConnectionsPage.tsx`), fourth in the header. On phones the header links are icons, with the current page's
  name beside its icon from 360px wide. Connecting Gmail returns to this page; "Set up connections" on an empty
  dashboard links to it.
- **All Benefits:** "Search and filter" is collapsed until its header is clicked (or "/" is pressed, which also
  focuses the search box). Filters keep applying while it's closed, and the header shows "1 filter on" etc.

### 15. The Claude Design look, and using benefits (2 October 2026)

- **Look:** restyled to match the Claude Design prototype (`design/Squirrel.html`): frosted-glass cards and header,
  a soft background glow, the design's light and dark colours, a hero panel on the dashboard and a squirrel
  illustration per category (`CategoryArt.tsx`, drawings in `src/assets/category-scenes.svg`).
- **Using benefits:** each benefit has a main button by kind (`lib/usage.ts`): vouchers and other one-time
  benefits get **Mark as used**, which moves them to a **Used** section on All Benefits (with Restore); card
  credits with a dollar amount get **Log a use** and a "$3 of $15 left" balance, and stay listed as
  "Used up · resets …" when spent; points balances get **Update balance**; subscriptions get a
  **Remind me before renewal** switch. Every change shows a toast with **Undo**.
- New saved fields `used_on` and `used_amount` (never set by the model). Used benefits get no reminders and are
  left out of the digest and the Assistant. `credit_total` is worked out from a card perk's value; Uber Cash's
  December period uses the $35.
- **Edit and Remove** moved into a ⋯ menu (`ui/MoreMenu.tsx`), drawn on `<body>` so cards can't cover it.
- Stamp cards from the design were skipped on purpose.
- **Copy code:** benefits have a `code` field. The model copies a voucher or promo code from the email, and
  `validate()` keeps it only if it appears in the email word for word, so a made-up code is dropped. Users can
  type or change it in the Add and Edit form. Cards with a code show it (selectable) and a **Copy code** button.
  The demo's Birthday drink, Store credit, Companion fare and Glow Spa vouchers have codes.

## Known gaps and limitations

- **AI features never run live** (no OpenAI key yet). The Responses API calls, strict schemas and prompts are untested against the real API, and the prompts were written for Claude.
- **Google sign-in and Gmail scanning not yet tried end to end in a browser.** The OAuth client and Gmail API access are verified; the flows were tested with Google mocked.
- **Card perk catalog is hand-written sample data**, last checked mid-2025, and US cards only. Issuers change perks; verify each card before trusting it. Custom cards and user-defined perks aren't supported yet.
- **No email verification or account deletion.** (Password reset is done; see section 11.)
- **Scan jobs live in server memory.** Restarting the server mid-scan loses progress (already-processed emails are kept).
- **No real browser click-through yet.** Checks so far are screenshots plus API tests with `curl`.
- **No automated tests are saved in the repo.** The offline checks run during development were throwaway scripts.
- **Reminders are email only**, sent by a thread inside `server.py`: none go out while the server is stopped (a missed one is sent at the next check if the benefit hasn't expired). No push or in-app notifications. The email has no one-click unsubscribe, only a link to the settings. The background thread's own send hasn't been watched end to end yet; the sample was sent by calling the same code directly.
- **Time zone comes from the last device used.** Someone travelling gets reminders on that device's clock; there's no manual time-zone picker.
- **Sending through a personal Gmail account** is limited (about 500 emails a day) and may be flagged as bulk mail. Fine for testers; use a sending service (e.g. Amazon SES, Postmark, Resend) with a custom domain before launch.
- **Categories of benefits saved before 1 October were guessed** from their names (`_add_benefit_types` in `db.py`). Wrong guesses need fixing by hand with Edit.
- **No Outlook yet** (see Owner decisions). IMAP only reads the inbox folder, not archives or other folders, and a server that can't search message text can't be scanned.
- **Long emails are cut to 8,000 characters** (a known limitation for long forwarded threads).
- **SQLite, one server process.** Fine for testers; not built for many users or several servers.
- **Answers appear all at once.** The skill recommends streaming them, which would need the server to stream.
- **Removed benefits can't be restored** from the app. Filters on the All benefits page aren't kept in the URL.
- **The project isn't a git repository**, so there's no history or undo. **The database isn't backed up either:** the copies made before this session's migrations were in a temporary folder and won't last. `instance/` holds all user data and the encryption key (`secret.key`); losing the key makes saved Gmail tokens and IMAP passwords unreadable.

---

## Next steps (suggested order)

1. **Set `OPENAI_API_KEY`** (see top), then try the full flow live: Google sign-in, Gmail scan, digest and assistant. Check the extraction quality with the chosen model. (Google client secret rotated and Gmail API enabled, 1 October 2026.)
2. **Run `git init`** and commit. `.gitignore` already excludes `.env`, `instance/` and `node_modules`. Also copy `instance/` (database + `secret.key`) somewhere safe from time to time.
3. **Finish the Google checks** (see "Before anything else" step 2): one client secret listed, then sign in with Google and connect Gmail in the browser.
4. **Watch a real reminder arrive.** Once your account has benefits, leave reminders on, keep `server.py` running past 8am Singapore time, and check that the email arrives once (and not again at the next 15-minute check). The demo account has reminders off on purpose (example.com isn't a real inbox).
5. **Verify the card catalog and loyalty programs** against current terms and sending domains, and fix `cards.py` / `loyalty.py`. Add more programs (non-US hotels and airlines) as needed.
6. **Custom cards and perks.**
7. **Add tests:** pytest for `validate()`, auth, OAuth state handling, the period maths and the endpoints (Google + OpenAI mocked); React Testing Library for sign-in, connections and the new pages.
8. **Automatic email scans** (daily, Gmail and IMAP), instead of only when the user presses "Scan inbox".
9. **Outlook / Microsoft 365 connection** (owner asked to be reminded; see Owner decisions).
10. **Email verification and account deletion** (deletion should also remove Gmail and IMAP data). (SMTP is set up: reset emails come from Squirrel Support <squirrelappsg@gmail.com>.)
11. **Build an extraction eval** from real benefit emails.
12. **Live KrisFlyer balances (optional):** prototype against Singapore Airlines' free sandbox, then apply for a KrisFlyer partnership once the app is hosted (see Owner decisions). Talk to Accor about balance access at the same time.
13. **When Squirrel is put online, set `APP_URL` in `.env`** to its real address (e.g. `https://squirrel.example.com`). Links in emails (reminders, password resets) and the Google sign-in return address are built from it; it's `http://127.0.0.1:8000` until then, which only works on this computer. Add the new address's `/api/auth/google/callback` to the Google client's authorised redirect URIs too.
14. **Before any public launch:** HTTPS hosting, Postgres, Google's restricted-scope verification and security assessment, a privacy policy, a proper email sending service with a custom domain (instead of a Gmail account), a one-click unsubscribe link in reminder emails, and moving the reminder check out of the web server (a scheduled job) so it keeps running across restarts and several servers.
