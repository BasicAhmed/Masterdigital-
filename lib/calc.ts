import { PAIRS, findPair, type CurrencyCode } from "./currencies";

/** Pure money math — no Firebase, no React. Everything the transaction form,
 *  the public calculator and the finance dashboard show comes from here.
 *
 *  Rates are always written the way the board shows them: "`unit` base =
 *  X quote". A route going base→quote pays out amount/unit × rate; a route
 *  going quote→base pays out amount/rate × unit. `cost` is what that same
 *  exchange costs the business, in the same convention. The gap between
 *  cost and the customer rate is the spread profit — and because every
 *  route stores its own cost and rate, USDT→SDG and SDG→USDT earn
 *  different margins. */

export function isForward(from: CurrencyCode, to: CurrencyCode): boolean {
  const p = findPair(from, to);
  return !!p && p.base === from;
}

/** Units of `to` received for 1 unit of `from` at a quoted board rate. */
export function perUnit(from: CurrencyCode, to: CurrencyCode, quoted: number): number {
  const p = findPair(from, to);
  if (!p || !quoted) return 0;
  return p.base === from ? quoted / p.unit : p.unit / quoted;
}

/** Margin % a customer rate earns over cost, for this direction. */
export function marginOf(from: CurrencyCode, to: CurrencyCode, cost: number, rate: number): number {
  const c = perUnit(from, to, cost);
  const r = perUnit(from, to, rate);
  if (!c) return 0;
  return ((c - r) / c) * 100;
}

/** Customer rate that earns `marginPercent` over `cost`, for this direction. */
export function rateFromMargin(from: CurrencyCode, to: CurrencyCode, cost: number, marginPercent: number): number {
  const m = marginPercent / 100;
  // forward: payout shrinks → quoted rate goes down. reverse: customer pays more → quoted rate goes up.
  return isForward(from, to) ? cost * (1 - m) : m >= 1 ? 0 : cost / (1 - m);
}

/** Rounds to 4 significant figures — board-style numbers (47,280 not 47,278.13). */
export function roundRate(v: number): number {
  if (!v || !isFinite(v)) return 0;
  const mag = Math.pow(10, 3 - Math.floor(Math.log10(Math.abs(v))));
  return Math.round(v * mag) / mag;
}

export type FeeSide = "from" | "to";

export interface TxInput {
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number; // what the customer hands over, in `from`
  rate: number; // customer rate (board convention)
  cost: number; // business cost rate (board convention)
  fee: number; // charged to the customer
  feeSide: FeeSide; // "to" = deducted from the payout, "from" = paid on top
  expense: number; // what the transfer cost the business (network/agent fees)
  expenseSide: FeeSide;
  usd: Record<string, number>; // units of each currency per 1 USD
}

export interface TxResult {
  gross: number; // payout before fees, in `to`
  payout: number; // what the customer actually receives, in `to`
  customerPays: number; // total the customer hands over, in `from`
  spread: number; // spread profit, in `to`
  marginPercent: number;
  volumeUsd: number;
  spreadUsd: number;
  feeUsd: number;
  expenseUsd: number;
  revenueUsd: number; // spread + fees
  profitUsd: number; // revenue − expenses
  profitMarginPercent: number; // profit / volume
}

export function toUsd(amount: number, code: string, usd: Record<string, number>): number {
  const r = usd[code];
  return r ? amount / r : 0;
}

export function computeTx(i: TxInput): TxResult {
  const r = perUnit(i.from, i.to, i.rate);
  const c = perUnit(i.from, i.to, i.cost);
  const gross = i.amount * r;
  const spread = i.amount * (c - r);
  const payout = i.feeSide === "to" ? gross - i.fee : gross;
  const customerPays = i.feeSide === "from" ? i.amount + i.fee : i.amount;
  const side = (s: FeeSide) => (s === "from" ? i.from : i.to);

  const volumeUsd = toUsd(i.amount, i.from, i.usd);
  const spreadUsd = toUsd(spread, i.to, i.usd);
  const feeUsd = toUsd(i.fee, side(i.feeSide), i.usd);
  const expenseUsd = toUsd(i.expense, side(i.expenseSide), i.usd);
  const revenueUsd = spreadUsd + feeUsd;
  const profitUsd = revenueUsd - expenseUsd;
  return {
    gross,
    payout,
    customerPays,
    spread,
    marginPercent: c ? ((c - r) / c) * 100 : 0,
    volumeUsd,
    spreadUsd,
    feeUsd,
    expenseUsd,
    revenueUsd,
    profitUsd,
    profitMarginPercent: volumeUsd ? (profitUsd / volumeUsd) * 100 : 0,
  };
}

/** Units of each currency per 1 USD, derived from the routes' own cost
 *  rates (USDT = 1 USD). Uses the midpoint of a pair's two cost rates and
 *  walks out from USDT, so no separate FX table has to be maintained. */
export function usdTable(costs: Record<string, number>): Record<string, number> {
  const mid = (a: string, b: string) => {
    const x = costs[`${a}_${b}`];
    const y = costs[`${b}_${a}`];
    return x && y ? (x + y) / 2 : x || y || 0;
  };
  const usd: Record<string, number> = { USDT: 1, USD: 1 };
  for (let pass = 0; pass < 4; pass++) {
    for (const p of PAIRS) {
      const m = mid(p.base, p.quote);
      if (!m) continue;
      const quotePerBase = m / p.unit;
      if (usd[p.base] && !usd[p.quote]) usd[p.quote] = usd[p.base] * quotePerBase;
      else if (usd[p.quote] && !usd[p.base]) usd[p.base] = usd[p.quote] / quotePerBase;
    }
  }
  return usd;
}
