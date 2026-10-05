# Master Digital — ماستر للخدمات المصرفية

Public website + full transfer/finance management system for Master Digital.
Next.js 14 (App Router), TypeScript, Tailwind, Firebase (Firestore + Auth).
Built on the FlyRate / Jodatransfer template, reworked around Master Digital's
business model.

## What's in it

**Public site (`/`)** — hero, the daily rates board (amount · from · to · sell · buy,
same layout as the printed rate sheet), calculator with WhatsApp ordering,
FAQ, contact.

**Management system (`/admin`)**

| Section | What it does |
|---|---|
| المالية (Finance) | Today / this-month performance, totals for any period (transactions, volume, revenue, profit, margin), daily profit chart, most-used and most-profitable routes, best customers, volume by currency, payment methods, monthly table, report export |
| المعاملات (Transactions) | Search + filter by customer, reference, date, route, currency, status · detail view · edit / status change / delete · CSV export |
| العملاء (Customers) | Add, search, sort · customer page with volume, revenue, profit, top routes and full history · statement export |
| الأسعار (Rates) | Every DIRECTION is its own route with its own cost, margin % and customer rate · on/off per route · refresh costs from live market |
| التواصل (Contact) | WhatsApp number, channel link, email, hours |

Flow: **Customer → Transaction → Route → Rate → automatic calculation → Revenue / Profit → Dashboard → Export**

## How the money math works (`lib/calc.ts`)

Rates are written the way the board shows them: "`unit` base = X quote"
(100,000 SDG = 47,280 UGX).

- `base → quote` (sell): payout = amount ÷ unit × rate
- `quote → base` (buy): payout = amount ÷ rate × unit
- Each route stores a **cost** rate and a **customer** rate. Spread profit =
  amount × (cost − customer), in the payout currency. USDT→SDG and SDG→USDT are
  separate routes, so they earn different margins.
- Revenue = spread + fees charged. Profit = revenue − costs paid (network / agent).
- Everything is converted to USD for the dashboard using a table derived from
  the routes' own cost rates (USDT = 1 USD), and **frozen on the transaction when
  it is saved** — later rate changes never rewrite history.
- Only **completed** transactions count toward revenue and profit.

Currencies: SDG, EGP, UGX, RWF, KES, USDT — 9 pairs, 18 routes
(`lib/currencies.ts`). Starting rates come from `data/routes.seed.json`.

## Run locally

```bash
npm install
npm run dev
```

With no env vars the site runs on the seed rates and `/admin` opens in **demo
mode**: everything works, but data is saved in that browser only and there is
no login. Use it to try the system; do not use it for real records.

## Go live (Firebase + Vercel)

1. Firebase Console → create a project → **Firestore Database** (production mode)
   and **Authentication → Email/Password**.
2. Authentication → Users → add one login per staff member.
3. Project settings → Your apps → Web → copy the config into Vercel env vars
   (names in `.env.example`).
4. Firestore → Rules → paste `firestore.rules` → Publish. Rates and contact
   details are public; customers and transactions need a login.
5. Import the repo in Vercel and deploy.

## Brand

Colours and fonts: `tailwind.config.ts` + `app/globals.css`. Logo:
`public/logo.png`. Default WhatsApp: `lib/settings.ts` (editable in /admin).
