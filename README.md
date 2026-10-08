# Master Digital — ماستر للخدمات المصرفية

Public website + full transfer/finance management system for Master Digital.
Next.js 14 (App Router), TypeScript, Tailwind, Firebase (Firestore + Auth).
Built on the FlyRate / Jodatransfer template, reworked around Master Digital's
business model.

## What's in it

**Public site (`/`)** — the Jodatransfer/FlyRate site as-is, rebranded: hero,
rate ticker, rates table, calculator (send/receive modes, 30-day history,
share card, WhatsApp ordering), FAQ, contact.

**Rates engine** — every currency has ONE price: units per 1 USDT, from
Binance P2P (`lib/fx.ts`). For each currency the BUY and SELL ad lists are read,
the first 2 ads are skipped (pinned / promoted), the next 5 are averaged, and the
price used is the middle of buy and sell. USDT, USD cash and USD South Sudan are
1:1. Any price can be typed by hand in /admin → الأسعار, which also shows the
buy, sell and the exact ads used. Every pair = price(a) ÷ price(b). Updated by
the daily cron and "تحديث الآن". Margins are per DIRECTION
(`marginForward` / `marginReverse` on `rates/{a_b}`).

**Management system (`/admin`)**

| Section | What it does |
|---|---|
| المالية (Finance) | Today / this-month performance, totals for any period (transactions, volume, revenue, profit, margin), daily profit chart, most-used and most-profitable routes, best customers, volume by currency, payment methods, monthly table, report export |
| المعاملات (Transactions) | Search + filter by customer, reference, date, route, currency, status · detail view · edit / status change / delete · CSV export |
| العملاء (Customers) | Add, search, sort · customer page with volume, revenue, profit, top routes and full history · statement export |
| الحسابات (Accounts) | Money owed to us / by us, per person or company · partial repayments until settled · per-currency and per-party balances · overdue flag · export |
| السيولة (Liquidity) | Balance per currency and total in USD, computed from completed transactions + repayments + manual deposits/withdrawals · movement log · export |
| تنبيهات الأسعار (Price alerts) | Alerts customers set from the calculator · flagged when the rate is reached · one-tap WhatsApp notice (email automatic when Resend is configured) |
| الاقتراحات والشكاوى (Feedback) | Inbox for suggestions, complaints and problem reports sent from the site |
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

Currencies: SDG, UGX, RWF, KES, EGP, SAR, AED, USDT, USD (cash), USDSS (USD South
Sudan) — every currency paired with every other: 45 pairs, 90 routes
(`lib/corridors.ts`). USDT, USD and USDSS are priced at 1 USD by the live update.

Liquidity categories (bank accounts, mobile money, cash in office…) per currency
are listed in `ACCOUNTS` in `lib/books.ts`; deposits, withdrawals and transactions
pick one, and the liquidity page shows each category's balance. Starting market prices: `data/rates.seed.json`.

## How the modules connect

All screens read one shared copy of the records (`app/admin/AdminApp.tsx`):

- A **completed transaction** adds what the customer paid to that currency's
  liquidity and removes the payout from the other currency.
- An **obligation** moves liquidity only when cash moved (a loan given or
  received) and on every **repayment**.
- The **finance dashboard** shows the same liquidity total and owed-to-us /
  owed-by-us figures as their own pages; a **customer page** shows that
  customer's open balance.
- The transaction form shows cash available in the payout currency and warns
  when the payout exceeds it.
- **Price alerts** are checked on every rate change in /admin and by the daily
  cron. **Favourites** are stored on the visitor's own device.

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
