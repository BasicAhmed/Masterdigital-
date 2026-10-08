export type CurrencyCode = "SDG" | "EGP" | "UGX" | "RWF" | "KES" | "SAR" | "AED" | "USDT" | "USD" | "USDSS";

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
  SAR: { code: "SAR", name: "السعودية", flag: "🇸🇦", currency: "الريال السعودي" },
  AED: { code: "AED", name: "الإمارات", flag: "🇦🇪", currency: "الدرهم الإماراتي" },
  USDT: { code: "USDT", name: "USDT (تيثر)", flag: "₮", currency: "تيثر" },
  USD: { code: "USD", name: "USD كاش", flag: "💵", currency: "الدولار كاش" },
  USDSS: { code: "USDSS", name: "USD جنوب السودان", flag: "🇸🇸", currency: "الدولار (جنوب السودان)" },
};

/** Currencies that always equal 1 USD for pricing and reporting. The live FX
 *  update (cron + "update now") prices them at 1, so their market price vs
 *  each other is 1 until it is changed by hand in /admin. */
export const USD_PEGGED: CurrencyCode[] = ["USDT", "USD", "USDSS"];

/** Units of `code` per 1 USD from a live FX table (open.er-api style). */
export function usdRateFor(code: CurrencyCode, usdRates: Record<string, number>): number | undefined {
  return USD_PEGGED.includes(code) ? 1 : usdRates[code];
}

export interface CurrencyPair {
  a: CurrencyCode;
  b: CurrencyCode;
}

/** Order of the currencies, from most units per 1 USD to fewest. It decides
 *  which side of a pair is `a` (a pair's market price is "units of `a` per 1
 *  `b`", so it is never a tiny fraction). Add a currency once, in its place
 *  in this list, and every corridor with it is created automatically. */
export const CURRENCY_ORDER: CurrencyCode[] = ["SDG", "UGX", "RWF", "KES", "EGP", "SAR", "AED", "USDT", "USD", "USDSS"];

/** Each PAIR is one corridor that works in both directions, priced from a
 *  single market price (see lib/rates.ts). Every currency is paired with
 *  every other one: 10 currencies → 45 pairs → 90 routes. */
export const PAIRS: CurrencyPair[] = CURRENCY_ORDER.flatMap((a, i) =>
  CURRENCY_ORDER.slice(i + 1).map((b) => ({ a, b }))
);

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
