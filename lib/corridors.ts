export type CurrencyCode = "SDG" | "EGP" | "UGX" | "RWF" | "KES" | "USDT";

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string; // Arabic display name
  flag: string; // emoji flag, or a symbol for non-country currencies like USDT
  currency: string; // Arabic currency name, used in WhatsApp messages
}

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  SDG: { code: "SDG", name: "السودان", flag: "🇸🇩", currency: "الجنيه السوداني" },
  EGP: { code: "EGP", name: "مصر", flag: "🇪🇬", currency: "الجنيه المصري" },
  UGX: { code: "UGX", name: "أوغندا", flag: "🇺🇬", currency: "الشلن الأوغندي" },
  RWF: { code: "RWF", name: "رواندا", flag: "🇷🇼", currency: "الفرنك الرواندي" },
  KES: { code: "KES", name: "كينيا", flag: "🇰🇪", currency: "الشلن الكيني" },
  USDT: { code: "USDT", name: "USDT (تيثر)", flag: "₮", currency: "تيثر" },
};

export interface CurrencyPair {
  a: CurrencyCode;
  b: CurrencyCode;
}

/** Each PAIR is one corridor that works in both directions, priced from a
 *  single market price (see lib/rates.ts for the formula). `a` and `b` just
 *  fix which side the stored marketPrice is quoted from — not a "forward is
 *  better" distinction. Add a currency's whole route list here once; both
 *  directions become available automatically. */
export const PAIRS: CurrencyPair[] = [
  // Sudanese pound
  { a: "SDG", b: "UGX" },
  { a: "SDG", b: "RWF" },
  { a: "SDG", b: "KES" },
  { a: "SDG", b: "USDT" },
  { a: "SDG", b: "EGP" },
  // Egyptian pound
  { a: "UGX", b: "EGP" },
  { a: "RWF", b: "EGP" },
  { a: "KES", b: "EGP" },
  { a: "EGP", b: "USDT" },
];

export function findPair(x: CurrencyCode, y: CurrencyCode): CurrencyPair | undefined {
  return PAIRS.find((p) => (p.a === x && p.b === y) || (p.a === y && p.b === x));
}

/** Firestore/seed key — always the pair's stored a_b order, regardless of
 *  which side someone is converting from. */
export function pairKey(x: CurrencyCode, y: CurrencyCode): string {
  const pair = findPair(x, y);
  if (!pair) throw new Error(`No corridor between ${x} and ${y}`);
  return `${pair.a}_${pair.b}`;
}

/** True when `from`→`to` matches the pair's stored a→b side (divide-by-rate
 *  math); false means it's the b→a side (multiply-by-rate math). Same market
 *  price either way — see computeRate in lib/rates.ts. */
export function isForwardDirection(from: CurrencyCode, to: CurrencyCode): boolean {
  const pair = findPair(from, to);
  return !!pair && pair.a === from && pair.b === to;
}

// Kept for components that only need "is this leg multiply or divide" —
// it's just the inverse of isForwardDirection now that a single market
// price drives both directions of a pair.
export function isMultiplyCorridor(from: CurrencyCode, to: CurrencyCode): boolean {
  const pair = findPair(from, to);
  return !!pair && !isForwardDirection(from, to);
}

export function validToCurrencies(from: CurrencyCode): CurrencyInfo[] {
  return PAIRS.filter((p) => p.a === from || p.b === from).map((p) =>
    CURRENCIES[p.a === from ? p.b : p.a]
  );
}

export const FROM_CURRENCIES: CurrencyInfo[] = Array.from(
  new Set(PAIRS.flatMap((p) => [p.a, p.b]))
).map((c) => CURRENCIES[c]);
