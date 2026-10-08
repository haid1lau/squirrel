# Squirrel: UI/UX progress

**App:** Squirrel, a benefits tracker for vouchers, memberships, card perks, credits, points and subscriptions
**Real app:** this folder (`server.py` + React in `frontend/`), at http://127.0.0.1:8000. Technical notes are in `PROGRESS.md` (section 15 covers this work).
**Design:** Claude Design project `b5107f8e-ccaa-4d8f-9529-bd4d99aaf944`, file `Squirrel.dc.html` ([link](https://claude.ai/design/p/b5107f8e-ccaa-4d8f-9529-bd4d99aaf944?file=Squirrel.dc.html)). The export is in `design/Squirrel.html`.
**Last updated:** 2026-10-08

## Where things stand
Everything from the Claude Design prototype, and every extra planned on top of it, is now in the real app. Stamp cards were left out on purpose.

| Step | What | Commit |
|---|---|---|
| 0 | Snapshot before any UI change (undo point) | `9f88c7d` |
| 1 | The look: glass cards and header, colours, background glow, hero panel, category squirrels | `636b42c` |
| 2 | Used state, Undo, Used section, a main action for each kind of benefit, ⋯ menu | `86359be` |
| 3 | Voucher codes with Copy code | `f902a95` |
| 4 | Animations: 3D header acorn, falling acorns, count-up, row collapse, fly to Benefits, badge pulse, sliding nav highlight, "All caught up" squirrel | `e2c4d7f` |
| 5 | Scan inbox progress; falling acorns on every use | `423d25a` |
| 6 | Assistant typing indicator and line-by-line answers | `d7b300b` |
| 7 | 50 falling acorns; credit cards as an Apple Wallet-style stack on Connections | `ade3347` |
| 8 | Your changes: reminders per benefit in the ⋯ menu; voucher codes hidden until tapped | `dd8b70b` |
| 9 | Livelier background: see-through glass, drifting autumn glow, paper grain | `3041310` |
| 10 | Woodland scene along the bottom; night forest with fireflies in dark mode; later 40% height, waterfall, mountains, more pines, solid colours | see git log |
| 11 | Landing page and new sign-in screen (Claude Design "Squirrel Login") | `34b77a1` |
| 12 | Design refresh: Bento dashboard, voucher tickets, swipe review, chat assistant | `6c3c72c` |
| 13 | Fireflies across the whole background in dark mode | `3fd7cf6` |
| 14 | Snowball the squirrel beside "Ready when you are." on the landing page | `09ead48` (PR #1) |
| 15 | Assistant answers shown as formatted text; shorter, scannable answers | `5d6ceee` |

## Decisions
- **Falling acorns:** 50 (raised from 30 on 2026-10-02). Don't suggest fewer. They play on every Mark as used and Log a use, and when the review queue is cleared, as in the prototype.
- **Main action by kind:** vouchers and other one-time benefits get Mark as used, and Copy code if they have one. Card credits get Log a use with a "$3 of $15 left" balance. Points get Update balance. Subscriptions and memberships have no main button.
- **Card credits** stay in the list when used up ("Used up · resets 1 Nov"). One-time benefits move to the Used section, which has Restore.
- **Codes** are saved from an email only if they appear in it word for word, so the AI can't invent one. They can also be typed in the Edit form. On the card a code is hidden under drifting dots (like Telegram spoilers) until tapped; Copy code works without revealing it.
- **Reminders** are set per benefit from its ⋯ menu → Reminder: 1 week (the default), 2 weeks, 1, 2, 3 or 6 months, 1 year before, or none. There are no account-wide or per-category reminder settings, and the Reminders card on Connections is gone.
- **Stamp cards:** skipped.
- **Credit cards** on Connections are an Apple Wallet-style stack: top strips show; tapping one brings it to the top with the others piled below, then its perks and Remove. Plain colour gradients by card, no bank logos.
- **Background:** cards are 72% opaque so the glow shows through; menus, toasts and the account dropdown use the nearly solid `glass-float`. Four colour patches (amber, sky, rust, moss) drift over 60 seconds, with a 5% grain on top. Colours are `--color-glow-*` tokens in `index.css`.
- **Woodland:** `Woodland.tsx`, fixed along the bottom behind everything, 40% of the screen height, or 22% of its width on ultrawide screens so the peaks aren't cut off (1440×640 canvas anchored to the bottom; phones show its right-hand end, zoomed in, so the gorge, waterfall and squirrel stay in view). A snow-capped mountain range, pine-covered far hills, rows of pines and oaks, a misty gorge between two pine-covered rock mountains (shaded inner walls, snowy summits, drifting fog) with an animated waterfall dropping through it into a rippling pool, a squirrel holding an acorn, fallen leaves and acorns. Each layer is one solid colour (paler with distance), so nearer trees and the squirrel fully hide what's behind them. Night forest with 12 fireflies in dark mode, plus 16 more (`Fireflies.tsx`) drifting across the whole background so they show between the cards. Colours are `--wood-*` and `--water*` in `index.css`. With Reduce Motion, the water and fireflies stay still.
- **Landing page:** signed-out visitors see a scrolling introduction before the sign-in card (`components/landing/`). The design's "$240 saved on average" counter was left out (no real figure), and step 3 says reminders come a week before (the app sends one, not a second the day before).
- **Design refresh (from the "Squirrel design explorations" canvas, designs A, C, D and F):** dashboard numbers are compact Bento tiles (`KpiRow.tsx`: rust "Expiring in 30 days" tile with a ring and the next three, Tracked, and a yellow To review tile), with "Up next" beside a card-credits stack and an Ask Squirrel tile (`DashboardTiles.tsx`); the tiles open All Benefits pre-filtered (`?status=soon`, `?kind=credit`). All Benefits is a grid of tickets (`BenefitTicket.tsx`, notches cut with the `ticket` mask in `index.css`) with search and kind chips always shown, the rest under More filters, and the selected ticket's details and actions in a side panel (under the ticket on phones). The review queue is a swipeable card stack: right or → keeps, left or ← arms Dismiss (a second swipe or click removes), with one-tap dates. The Assistant has suggested-question chips, chat bubbles, cards for benefits an answer names (linking to `/benefits#benefit-<id>`) and an Expiring soon panel. The acorn, woodland, glow, acorn rain and every action are unchanged.
- **Assistant answers:** the AI writes light Markdown, shown by `AnswerText.tsx` as paragraphs, lists and bold names (never raw HTML), with dates like "9 Oct". The prompt asks for a one- or two-sentence answer, then at most 5 one-line bullets, under about 120 words, with no expired benefits.
- **Reduce Motion:** the acorn stays still, there are no falling acorns, and other animations become fades.

## Not tested yet (needs real data)
- The "+1" flight from the review queue, the review-queue acorns and the "All caught up" squirrel. These need confirming or dismissing review items, which can't be undone in the demo.
- "Update balance": both demo points benefits are still waiting for review.

## Running it
Start the server in your own terminal (or the "Squirrel server" tab in Claude's Terminal panel). Another Claude session working in a `.claude/worktrees/` copy may start its own server on port 8000; that copy has no `.env`, so Google sign-in shows as "not set up" until the main one is running again.
```bash
cd "/Users/claytonlau/Documents/AI lodge/BenefitApp" && /opt/anaconda3/bin/python3 server.py
```
After frontend changes: `cd frontend && npm run build`. After backend changes: restart the server. The demo account is in `demo_seed.py`.

## Ideas not yet asked for
- The acorn's look: three.js changed its lighting since the version the design used, so it's matched by eye. Adjust the size, colour or angle if it looks off.
