# Master Digital — ماستر للخدمات المصرفية

Public website + full transfer/finance management system for Master Digital.
Next.js 14 (App Router), TypeScript, Tailwind, Firebase (Firestore + Auth).
Built on the FlyRate / Jodatransfer template, reworked around Master Digital's
business model.

## What's in it

**Public site (`/`)** — the Jodatransfer/FlyRate site as-is, rebranded: hero,
rate ticker, rates table, calculator (send/receive modes, 30-day history,
share card, WhatsApp ordering), FAQ, contact.

**Rates engine** — unchanged from the template: one market price per pair,
daily cron + "update now" from live FX, SDG from Binance P2P, manual USDT/SDG
override, global margin, per-direction on/off. **One change:** the margin
override is per DIRECTION (`marginForward` / `marginReverse` on `rates/{a_b}`),
so USDT → SDG and SDG → USDT earn different percentages.

**Management system (`/admin`)**

| Section | What it does |
|---|---|
| المالية (Finance) | Today / this-month performance, totals for any period (transactions, volume, revenue, profit, margin), daily profit chart, most-used and most-profitable routes, best customers, volume by currency, payment methods, monthly table, report export |
| المعاملات (Transactions) | Search + filter by customer, reference, date, route, currency, status · detail view · edit / status change / delete · CSV export |
| العملاء (Customers) | Add, search, sort · customer page with volume, revenue, profit, top routes and full history · statement export |
| الأسعار (Rates) | The template's rates screen, with a margin field on each direction |
| التواصل (Contact) | WhatsApp number, channel link, email, hours |

Flow: **Customer → Transaction → Route → Rate → automatic calculation → Revenue / Profit → Dashboard → Export**

## How the money math works

Same as the template (`lib/rates.ts`): a pair's market price is "X of `a` per
1 `b`". a → b: rate = market × (1 + margin), received = amount ÷ rate.
b → a: rate = market × (1 − margin), received = amount × rate.

A transaction (`lib/calc.ts`) pre-fills the route's customer rate and its
market price as cost. Spread profit = what the amount is worth at market −
what the customer is paid. Revenue = spread + fees charged. Profit = revenue −
costs paid. Figures are converted to USD (USDT = 1 USD, from the market
prices) and **frozen on the transaction when saved**. Only **completed**
transactions count toward revenue and profit.

Currencies: SDG, EGP, UGX, RWF, KES, USDT — 9 pairs, 18 routes
(`lib/corridors.ts`). Starting market prices: `data/rates.seed.json`.

## Run locally

```bash
npm install
npm run dev
```

With no env vars the site runs on the seed prices and `/admin` opens in **demo
mode**: customers, transactions and the dashboard work but are saved in that
browser only, there is no login, and rates cannot be saved. Use it to try the
system; do not use it for real records.

## Go live (Firebase + Vercel)

1. Firebase Console → create a project → **Firestore Database** (production mode)
   and **Authentication → Email/Password**.
2. Authentication → Users → add one login per staff member.
3. Project settings → Your apps → Web → copy the config into Vercel env vars
   (names in `.env.example`). Add `FIREBASE_SERVICE_ACCOUNT` and `CRON_SECRET`
   for the daily rate update (`vercel.json`).
4. Firestore → Rules → paste `firestore.rules` → Publish.
5. Import the repo in Vercel and deploy, then press "تحديث الآن" in /admin.

## Brand

Colours and fonts: `tailwind.config.ts` + `app/globals.css`. Logo:
`public/logo.png`. Default WhatsApp: `lib/settings.ts` (editable in /admin).
