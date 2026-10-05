export type CurrencyCode = "SDG" | "EGP" | "UGX" | "RWF" | "KES" | "USDT";

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string; // Arabic currency name
  country: string;
  flag: string;
  decimals: number; // decimals shown for amounts in this currency
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  SDG: { code: "SDG", name: "جنيه سوداني", country: "السودان", flag: "🇸🇩", decimals: 0 },
  EGP: { code: "EGP", name: "جنيه مصري", country: "مصر", flag: "🇪🇬", decimals: 0 },
  UGX: { code: "UGX", name: "شلن أوغندي", country: "أوغندا", flag: "🇺🇬", decimals: 0 },
  RWF: { code: "RWF", name: "فرنك رواندي", country: "رواندا", flag: "🇷🇼", decimals: 0 },
  KES: { code: "KES", name: "شلن كيني", country: "كينيا", flag: "🇰🇪", decimals: 0 },
  USDT: { code: "USDT", name: "USDT", country: "تيثر", flag: "₮", decimals: 2 },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

/** A pair is quoted the way Master Digital's daily board quotes it:
 *  "`unit` of `base` = X `quote`" (e.g. 100,000 SDG = 47,280 UGX).
 *  Each pair yields TWO independent routes — base→quote and quote→base —
 *  and every route carries its own cost, margin and customer rate. */
export interface Pair {
  base: CurrencyCode;
  quote: CurrencyCode;
  unit: number;
}

export const PAIRS: Pair[] = [
  { base: "SDG", quote: "UGX", unit: 100000 },
  { base: "SDG", quote: "RWF", unit: 100000 },
  { base: "SDG", quote: "KES", unit: 100000 },
  { base: "USDT", quote: "SDG", unit: 100 },
  { base: "EGP", quote: "SDG", unit: 1000 },
  { base: "EGP", quote: "UGX", unit: 1000 },
  { base: "EGP", quote: "RWF", unit: 1000 },
  { base: "EGP", quote: "KES", unit: 1000 },
  { base: "USDT", quote: "EGP", unit: 100 },
];

export function findPair(x: CurrencyCode, y: CurrencyCode): Pair | undefined {
  return PAIRS.find((p) => (p.base === x && p.quote === y) || (p.base === y && p.quote === x));
}

export function routeKey(from: string, to: string) {
  return `${from}_${to}`;
}

/** Every directed route the business works with (18). */
export const ROUTE_KEYS: { from: CurrencyCode; to: CurrencyCode }[] = PAIRS.flatMap((p) => [
  { from: p.base, to: p.quote },
  { from: p.quote, to: p.base },
]);

export function destinationsFor(from: CurrencyCode): CurrencyCode[] {
  return ROUTE_KEYS.filter((r) => r.from === from).map((r) => r.to);
}

export function routeLabel(from: string, to: string) {
  return `${from} → ${to}`;
}
