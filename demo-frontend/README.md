# Squirrel demo

A copy of `../frontend` that runs with no server, for showing Squirrel off
(e.g. on Vercel). `src/demo/server.ts` answers every API call in the browser
from sample data, and keeps changes in the visitor's browser only:

- Any email and password signs in; "Continue with Google", "Connect Gmail" and
  "Connect Outlook" connect straight away.
- Scans pretend to read emails for a few seconds, then add sample benefits.
- Assistant answers and the weekly digest come from simple rules, not AI.
- **Reset** (bottom left) puts everything back to the sample data.

The only other changes from `../frontend` are `src/lib/api.ts` (requests go to
`src/demo/server.ts`), the banner in `src/main.tsx`, and `vercel.json`.

## Run it

    npm ci
    npm run dev        # http://localhost:5173

## Deploy on Vercel

Import the repository in Vercel and set **Root Directory** to `demo-frontend`.
`vercel.json` sets the build (`npm run build`, output `dist`) and sends every
page to `index.html`. No environment variables are needed.

## Refresh the sample data

`src/demo/data.json` is captured from the real app (benefits, card catalog
and the perks each card adds). After changing those, run from the project
folder:

    python3 demo-frontend/capture_demo_data.py

Dates are moved to the visitor's today automatically, so it doesn't go stale.
