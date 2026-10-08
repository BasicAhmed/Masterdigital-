import { CURRENCIES as BASE, PAIRS as CORRIDORS, type CurrencyCode } from "./corridors";

export type { CurrencyCode };

/** The management screens (transactions, customers, finance) read currencies
 *  and pairs from the same corridor list the public site uses — this file
 *  only reshapes it. Nothing is defined twice. */
export interface CurrencyInfo {
  code: CurrencyCode;
  name: string; // Arabic currency name
  country: string;
  flag: string;
  decimals: number;
}

/** Currencies shown with cents; the rest are whole numbers. */
const TWO_DECIMALS: CurrencyCode[] = ["USDT", "USD", "USDSS", "SAR", "AED"];

export const CURRENCIES = Object.fromEntries(
  Object.values(BASE).map((c) => [
    c.code,
    {
      code: c.code,
      name: c.code === "USDT" ? "USDT" : c.currency,
      country: c.name,
      flag: c.flag,
      decimals: TWO_DECIMALS.includes(c.code) ? 2 : 0,
    },
  ])
) as Record<CurrencyCode, CurrencyInfo>;

export const CURRENCY_LIST = Object.values(CURRENCIES);

/** A corridor's market price is "X of `a` per 1 `b`". In board terms that is
 *  base = b, quote = a, unit = 1. */
export interface Pair {
  base: CurrencyCode;
  quote: CurrencyCode;
  unit: number;
}

export const PAIRS: Pair[] = CORRIDORS.map((p) => ({ base: p.b, quote: p.a, unit: 1 }));

export function findPair(x: CurrencyCode, y: CurrencyCode): Pair | undefined {
  return PAIRS.find((p) => (p.base === x && p.quote === y) || (p.base === y && p.quote === x));
}

export function routeKey(from: string, to: string) {
  return `${from}_${to}`;
}

/** Every directed route (two per corridor). */
export const ROUTE_KEYS: { from: CurrencyCode; to: CurrencyCode }[] = CORRIDORS.flatMap((p) => [
  { from: p.a, to: p.b },
  { from: p.b, to: p.a },
]);

export function destinationsFor(from: CurrencyCode): CurrencyCode[] {
  return ROUTE_KEYS.filter((r) => r.from === from).map((r) => r.to);
}

export function routeLabel(from: string, to: string) {
  return `${from} → ${to}`;
}
