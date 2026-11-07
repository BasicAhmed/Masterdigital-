/** Built-in codes are below; the owner can add more from /admin
 *  (settings/currencies), so a code is any string. */
export type CurrencyCode = string;

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


export interface CurrencyPair {
  a: CurrencyCode;
  b: CurrencyCode;
}

/** Order of the currencies, from most units per 1 USD to fewest. It decides
 *  which side of a pair is `a` (a pair's market price is "units of `a` per 1
 *  `b`", so it is never a tiny fraction). Add a currency once, in its place
 *  in this list, and every corridor with it is created automatically. */
export const CURRENCY_ORDER: CurrencyCode[] = ["SDG", "UGX", "RWF", "KES", "EGP", "SAR", "AED", "USDT", "USD", "USDSS"];
const BUILT_IN_ORDER = [...CURRENCY_ORDER];
export const BUILT_IN_CODES = new Set(BUILT_IN_ORDER);

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

/* ---------- Currencies added by the owner (settings/currencies) ---------- */

export interface CustomCurrency {
  code: string; // e.g. "ETB"
  country: string; // e.g. "إثيوبيا"
  currency: string; // e.g. "البر الإثيوبي"
  flag: string; // emoji, may be empty
  perUsd: number; // roughly how many units = 1 USD — decides its place in the list
  decimals: number; // 0 or 2
  binance: boolean; // try Binance P2P for its price
  createdAt?: string;
}

/** Rough units per 1 USD of the built-in currencies — only used to slot an
 *  added currency into CURRENCY_ORDER (pairs are stored as "more units per
 *  fewer units"). Never used for pricing. */
const APPROX_PER_USD: Record<string, number> = {
  SDG: 10000, UGX: 3700, RWF: 1450, KES: 130, EGP: 50, SAR: 3.75, AED: 3.67, USDT: 1, USD: 1, USDSS: 1,
};

const listeners: (() => void)[] = [];
/** Modules that keep their own copy of the list re-build it when this fires. */
export function onCurrenciesChange(fn: () => void) {
  listeners.push(fn);
}

let customSig = "";
export let CUSTOM_CURRENCIES: CustomCurrency[] = [];

export function cleanCustomCurrencies(raw: unknown): CustomCurrency[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const out: CustomCurrency[] = [];
  for (const r of list as Record<string, unknown>[]) {
    const code = String(r?.code ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2,6}$/.test(code) || BUILT_IN_CODES.has(code) || seen.has(code)) continue;
    const perUsd = Number(r.perUsd);
    if (!(perUsd > 0)) continue;
    seen.add(code);
    out.push({
      code,
      country: String(r.country ?? code).slice(0, 40),
      currency: String(r.currency ?? code).slice(0, 40),
      flag: String(r.flag ?? "").slice(0, 8),
      perUsd,
      decimals: Number(r.decimals) === 2 ? 2 : 0,
      binance: r.binance !== false,
      ...(typeof r.createdAt === "string" ? { createdAt: r.createdAt } : {}),
    });
  }
  return out;
}

/** Adds the owner's currencies to the lists every page uses. Safe to call
 *  again with the same list (does nothing) or a new one (rebuilds). */
export function registerCurrencies(raw: unknown) {
  const list = cleanCustomCurrencies(raw);
  const sig = JSON.stringify(list);
  if (sig === customSig) return;
  customSig = sig;
  CUSTOM_CURRENCIES = list;

  for (const code of Object.keys(CURRENCIES)) if (!BUILT_IN_CODES.has(code)) delete CURRENCIES[code];
  for (const c of list) {
    CURRENCIES[c.code] = { code: c.code, name: c.country, flag: c.flag || "💱", currency: c.currency };
  }

  // Slot each one in by size; ties keep the built-in first so stored pair
  // keys of existing currencies never flip.
  const order = [...BUILT_IN_ORDER];
  for (const c of [...list].sort((x, y) => y.perUsd - x.perUsd)) {
    const at = order.findIndex((code) => (APPROX_PER_USD[code] ?? CUSTOM_CURRENCIES.find((k) => k.code === code)?.perUsd ?? 0) < c.perUsd);
    order.splice(at === -1 ? order.length : at, 0, c.code);
  }
  CURRENCY_ORDER.splice(0, CURRENCY_ORDER.length, ...order);
  PAIRS.splice(0, PAIRS.length, ...CURRENCY_ORDER.flatMap((a, i) => CURRENCY_ORDER.slice(i + 1).map((b) => ({ a, b }))));
  FROM_CURRENCIES.splice(0, FROM_CURRENCIES.length, ...CURRENCY_ORDER.map((c) => CURRENCIES[c]));
  for (const fn of listeners) fn();
}
