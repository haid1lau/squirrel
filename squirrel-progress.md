# Squirrel: UI/UX progress

**App:** Squirrel, a benefits tracker for vouchers, memberships, card perks, credits, points and subscriptions
**Real app:** this folder (`server.py` + React in `frontend/`), at http://127.0.0.1:8000. Technical notes are in `PROGRESS.md` (section 15 covers this work).
**Design:** Claude Design project `b5107f8e-ccaa-4d8f-9529-bd4d99aaf944`, file `Squirrel.dc.html` ([link](https://claude.ai/design/p/b5107f8e-ccaa-4d8f-9529-bd4d99aaf944?file=Squirrel.dc.html)). The export is in `design/Squirrel.html`.
**Last updated:** 2026-10-03

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
| 10 | Woodland scene along the bottom; night forest with fireflies in dark mode | see git log |

## Decisions
- **Falling acorns:** 50 (raised from 30 on 2026-10-02). Don't suggest fewer. They play on every Mark as used and Log a use, and when the review queue is cleared, as in the prototype.
- **Main action by kind:** vouchers and other one-time benefits get Mark as used, and Copy code if they have one. Card credits get Log a use with a "$3 of $15 left" balance. Points get Update balance. Subscriptions and memberships have no main button.
- **Card credits** stay in the list when used up ("Used up · resets 1 Nov"). One-time benefits move to the Used section, which has Restore.
- **Codes** are saved from an email only if they appear in it word for word, so the AI can't invent one. They can also be typed in the Edit form. On the card a code is hidden under drifting dots (like Telegram spoilers) until tapped; Copy code works without revealing it.
- **Reminders** are set per benefit from its ⋯ menu → Reminder: 1 week (the default), 2 weeks, 1, 2, 3 or 6 months, 1 year before, or none. There are no account-wide or per-category reminder settings, and the Reminders card on Connections is gone.
- **Stamp cards:** skipped.
- **Credit cards** on Connections are an Apple Wallet-style stack: top strips show; tapping one brings it to the top with the others piled below, then its perks and Remove. Plain colour gradients by card, no bank logos.
- **Background:** cards are 72% opaque so the glow shows through; menus, toasts and the account dropdown use the nearly solid `glass-float`. Four colour patches (amber, sky, rust, moss) drift over 60 seconds, with a 5% grain on top. Colours are `--color-glow-*` tokens in `index.css`.
- **Woodland:** `Woodland.tsx`, fixed along the bottom behind everything, 40% of the screen height (drawn on a 240-tall grid and scaled up 2×; cropped at the sides on phones). Four layers of hills and oaks and pines, a squirrel holding an acorn, fallen leaves and acorns. Pale autumn silhouettes in light mode; night forest with 12 fireflies in dark mode. Colours and opacities are `--wood-*` in `index.css`. With Reduce Motion, the fireflies glow without moving.
- **Reduce Motion:** the acorn stays still, there are no falling acorns, and other animations become fades.

## Not tested yet (needs real data)
- A real Gmail scan and real Assistant answers: `OPENAI_API_KEY` in `.env` is still empty. The scan and typing animations were checked with faked responses only.
- The "+1" flight from the review queue, the review-queue acorns and the "All caught up" squirrel. These need confirming or dismissing review items, which can't be undone in the demo.
- "Update balance": both demo points benefits are still waiting for review.

## Running it
Start the server in your own terminal. A copy started from a Claude session stops after at most 2 hours.
```bash
cd "/Users/claytonlau/Documents/AI lodge/BenefitApp" && /opt/anaconda3/bin/python3 server.py
```
After frontend changes: `cd frontend && npm run build`. After backend changes: restart the server. The demo account is in `demo_seed.py`.

## Ideas not yet asked for
- All Benefits: a search bar with filter chips instead of the large filter panel
- Dashboard stat cards that open the matching filtered list when tapped
- Assistant: suggested-question chips
- The acorn's look: three.js changed its lighting since the version the design used, so it's matched by eye. Adjust the size, colour or angle if it looks off.
