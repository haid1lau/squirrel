# Squirrel: UI/UX review progress

**App:** Squirrel, a benefits tracker for vouchers, memberships, card perks, credits, points and subscriptions
**Design:** Claude Design project `b5107f8e-ccaa-4d8f-9529-bd4d99aaf944`, file `Squirrel.dc.html`
**Link:** https://claude.ai/design/p/b5107f8e-ccaa-4d8f-9529-bd4d99aaf944?file=Squirrel.dc.html
**Last updated:** 2026-10-02

## How we work
1. Claude reviews the design in the built-in browser pane, which needs you signed in to claude.ai.
2. Claude writes a prompt; you paste it into Claude Design.
3. Claude re-checks the result and lists what's done and what's still open.

## Decisions made
- **Falling acorns:** keep the current number (about 30). Don't reduce them. They play only for big wins: a credit, multi-use voucher or lounge visits fully used, or the review queue cleared.
- **Main action depends on benefit type:**
  - Vouchers: Mark as used, plus Show code or Copy code
  - Credits: Log a use, with balance and reset date
  - Stamps: Add a stamp
  - Points: Update balance
  - Always-on memberships: How to use
  - Subscriptions: a reminder toggle
- **Recurring credits** stay in the list when used up ("Used this month · resets 1 Nov"). Only one-time benefits move to "Used".
- **Edit form** reuses the Add form. It has "Found in" (Gmail, Card link, Manual) and "Program / card" fields, and credits have Amount plus Resets.
- **Placeholder barcodes** are fine for the prototype. The three code-sheet variants are barcode, text code with Copy, and no code.
- **Background:** a small 3D acorn in the Dashboard header only, with calm backgrounds on the list pages.

## Done ✅
- Readability over the background (higher card opacity, acorn moved out from behind content)
- Mark as used with Undo, Show code sheet, ⋯ menu for Edit and Remove
- Consistent counts ("N active · N to review")
- Review queue: date left empty, quick-pick chips, Suggested chip in the row, date field shown only after tapping Pick a date, Undo after Dismiss
- Actions by benefit type, Log a use dialog with an over-balance error and "Use all", descriptions that update
- Progress bars show balance used on credits
- Copy code button for text-code vouchers (Companion fare, PawPantry)
- ⋯ menu draws above other cards, opens upward near the bottom, and the whole row is tappable
- Confirmed review items count as tracked
- Header acorn fills the "Clayton's benefits" box with a small margin (checked 2026-10-02)
- Counts are consistent: 17 benefits in total. Birthday drink and $5 off had only been marked used during testing, and both are now restored
- Motion: stat cards count up and stagger in, used cards collapse, confirmed items fly to Benefits, "All caught up" squirrel, acorns render behind the toast and never rest on buttons, Reduce Motion respected

## Open ⏳
1. **Small bug (optional):** the "Used" section ignores the search box. Searching "Birthday" still listed "$5 off $30 order" under Used. Prompt:
   > On All Benefits, apply the same search and filters to the "Used" section as to the main list, and hide the Used section when nothing in it matches.

## Next (planned, not started)
**Extra animations.** Paste this when ready:
```
Add a few small, purposeful animations (keep all existing ones, including the current number of falling acorns):
1. Scan inbox: while scanning, show the squirrel digging with a progress line ("Checked 50 of 312 emails…") and finish with "Found 3 new benefits" that links to the review queue.
2. Add a stamp: the new stamp presses in with a small bounce and the count ticks up; on the final stamp (e.g. 10 of 10), play the falling-acorn celebration.
3. Assistant: show a typing indicator while answering, then reveal the answer line by line.
4. Copy code: the button briefly morphs into a check mark for about 1s, alongside the "Copied" toast.
Durations 150–300ms (except the scan progress). Respect prefers-reduced-motion: replace motion with simple fades.
```
**Not doing:** more celebrations, hover or idle card animations, page transitions, continuously pulsing badges.

**After that:** review the screens not yet covered in detail: Connections (Gmail, other email, credit cards / card perks) and the Assistant answers.

## Backlog from the first review (not yet asked for)
- Benefits page: replace the large filter panel with a search bar plus filter chips, and put Sort and Source in a sheet
- Make the Dashboard stat cards tappable, each opening the matching filtered list
- Assistant: suggested-question chips
- Check tap targets are at least 44pt (avatar, theme toggle, ⋯ buttons)
