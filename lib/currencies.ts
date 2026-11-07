import { CURRENCIES as BASE, CUSTOM_CURRENCIES, PAIRS as CORRIDORS, onCurrenciesChange, type CurrencyCode } from "./corridors";

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

const infoOf = (c: (typeof BASE)[string]): CurrencyInfo => ({
  code: c.code,
  name: c.code === "USDT" ? "USDT" : c.currency,
  country: c.name,
  flag: c.flag,
  decimals: TWO_DECIMALS.includes(c.code) ? 2 : CUSTOM_CURRENCIES.find((k) => k.code === c.code)?.decimals ?? 0,
});

// These are kept as the same objects/arrays and refilled in place when the
// owner adds a currency, so every import sees the new one.
export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {};
export const CURRENCY_LIST: CurrencyInfo[] = [];

/** A corridor's market price is "X of `a` per 1 `b`". In board terms that is
 *  base = b, quote = a, unit = 1. */
export interface Pair {
  base: CurrencyCode;
  quote: CurrencyCode;
  unit: number;
}

export const PAIRS: Pair[] = [];

export function findPair(x: CurrencyCode, y: CurrencyCode): Pair | undefined {
  return PAIRS.find((p) => (p.base === x && p.quote === y) || (p.base === y && p.quote === x));
}

export function routeKey(from: string, to: string) {
  return `${from}_${to}`;
}

/** Every directed route (two per corridor). */
export const ROUTE_KEYS: { from: CurrencyCode; to: CurrencyCode }[] = [];

function rebuild() {
  for (const k of Object.keys(CURRENCIES)) delete CURRENCIES[k];
  for (const c of Object.values(BASE)) CURRENCIES[c.code] = infoOf(c);
  CURRENCY_LIST.splice(0, CURRENCY_LIST.length, ...Object.values(CURRENCIES));
  PAIRS.splice(0, PAIRS.length, ...CORRIDORS.map((p) => ({ base: p.b, quote: p.a, unit: 1 })));
  ROUTE_KEYS.splice(
    0,
    ROUTE_KEYS.length,
    ...CORRIDORS.flatMap((p) => [
      { from: p.a, to: p.b },
      { from: p.b, to: p.a },
    ])
  );
}
rebuild();
onCurrenciesChange(rebuild);

export function destinationsFor(from: CurrencyCode): CurrencyCode[] {
  return ROUTE_KEYS.filter((r) => r.from === from).map((r) => r.to);
}

export function routeLabel(from: string, to: string) {
  return `${from} → ${to}`;
}
