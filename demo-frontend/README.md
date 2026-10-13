# Squirrel demo

A copy of `../frontend` that runs with no server, for showing Squirrel off
(e.g. on Vercel). `src/demo/server.ts` answers every API call in the browser
from sample data, and keeps changes in the visitor's browser only:

- Any password works. Each email has its own account, kept separately:

  | Email | Who | Shows |
  |---|---|---|
  | clayton@demo.com | Clayton Lau | The full sample: Gmail, an Amex Platinum, memberships, items to review |
  | priya@demo.com | Priya Nair | Singapore: dining and entertainment vouchers, a gym trial, KrisFlyer, a DBS card |
  | marcus@demo.com | Marcus Tan | A frequent traveller: Chase Sapphire Reserve and Amex Gold credits, hotel and airline memberships |
  | sam@demo.com | Sam Lee | A new account with nothing connected, to show the first scan and adding a card |

  Any other email starts from Clayton's data. "Continue with Google", "Connect
  Gmail" and "Connect Outlook" connect straight away.
- Scans pretend to read emails for a few seconds, then add sample benefits.
- Assistant answers and the weekly digest come from simple rules, not AI.
- **Reset** (bottom left) puts every account back to its sample data.

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

`src/demo/data.json` is captured from the real app: each account's benefits,
the card catalog and the perks each card adds. Clayton's account comes from
`../demo_seed.py`; the others are `PERSONAS` in `capture_demo_data.py`.
After changing any of them, run this from the project folder:

    python3 demo-frontend/capture_demo_data.py

Dates are moved to the visitor's today automatically, so it doesn't go stale.
