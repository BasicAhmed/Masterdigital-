import { collection, getDocs, getDoc, doc, setDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";
import { PAIRS, pairKey, isForwardDirection, isMultiplyCorridor, type CurrencyCode } from "./corridors";
import { buildUsdtPrices, pairMarketPrices, type MarketData, type UsdtPrice, type UsdtPrices } from "./fx";
import { getMarginPercent } from "./settings";
import { roundForDisplay } from "./format";
import { appendRateHistory } from "./rateHistory";
import seed from "@/data/rates.seed.json";

export interface RateRow {
  from: CurrencyCode;
  to: CurrencyCode;
  marketPrice: number; // the pair's single true cross-rate, quoted a-per-b
  rate: number; // marketPrice adjusted by the profit margin — what customers see/get
  marginPercent: number; // the margin actually applied to THIS DIRECTION (its own override or the global default)
  marginOverride?: number; // set only if this direction has a custom margin; absent = using the global default
  updatedAt: string | null;
}

/** Applies a margin to a pair's single market price to get the
 *  customer-facing rate for ONE direction of that pair.
 *  marketPrice is always quoted as "units of pair.a per 1 unit of pair.b".
 *  a → b (forward): rate = marketPrice * (1 + margin); amount_b = amount_a / rate.
 *  b → a (reverse): rate = marketPrice * (1 - margin); amount_a = amount_b * rate.
 *  Both directions land worse than the fair mid-market cross rate, but each
 *  by ITS OWN margin: USDT → SDG and SDG → USDT are separate routes for
 *  Master Digital and can earn different percentages. */
export function computeRate(
  from: CurrencyCode,
  to: CurrencyCode,
  marketPrice: number,
  marginPercent: number
): number {
  const factor = marginPercent / 100;
  const raw = isForwardDirection(from, to) ? marketPrice * (1 + factor) : marketPrice * (1 - factor);
  return roundForDisplay(raw);
}

/** Per-direction margin overrides of one pair. `forward` is a→b, `reverse`
 *  is b→a; either can be absent (= that direction uses the global default). */
export interface PairMargins {
  forward?: number;
  reverse?: number;
}

function rowsForPair(
  from: CurrencyCode,
  to: CurrencyCode,
  marketPrice: number,
  defaultMargin: number,
  overrides: PairMargins,
  updatedAt: string | null
): RateRow[] {
  const forward = overrides.forward ?? defaultMargin;
  const reverse = overrides.reverse ?? defaultMargin;
  return [
    {
      from,
      to,
      marketPrice,
      rate: computeRate(from, to, marketPrice, forward),
      marginPercent: forward,
      marginOverride: overrides.forward,
      updatedAt,
    },
    {
      from: to,
      to: from,
      marketPrice,
      rate: computeRate(to, from, marketPrice, reverse),
      marginPercent: reverse,
      marginOverride: overrides.reverse,
      updatedAt,
    },
  ];
}

function seedRows(defaultMargin: number): RateRow[] {
  return seed.rates.flatMap((r) => {
    const a = r.from as CurrencyCode;
    const b = r.to as CurrencyCode;
    return rowsForPair(a, b, r.marketPrice, defaultMargin, {}, null);
  });
}

/** Reads all rates (one stored market price + optional margin override per
 *  pair → both directions' margin-adjusted rates). Pairs without their own
 *  override use the global default margin. Tries Firestore first; falls
 *  back to the bundled seed file so the site works before Firebase is
 *  wired up. Fetches the margin and the rates collection in parallel
 *  (they're independent reads) rather than one after another. */
export async function getRatesWithMargin(): Promise<{ rates: RateRow[]; defaultMargin: number }> {
  if (!firebaseEnabled || !db) {
    const defaultMargin = await getMarginPercent();
    return { rates: seedRows(defaultMargin), defaultMargin };
  }

  try {
    const [defaultMargin, snap] = await Promise.all([
      getMarginPercent(),
      getDocs(collection(db, "rates")),
    ]);
    if (snap.empty) return { rates: seedRows(defaultMargin), defaultMargin };

    const map = new Map<
      string,
      {
        marketPrice: number;
        margins: PairMargins;
        updatedAt: string | null;
      }
    >();
    snap.forEach((d) => {
      const data = d.data();
      map.set(d.id, {
        marketPrice: data.marketPrice,
        margins: {
          forward: typeof data.marginForward === "number" ? data.marginForward : undefined,
          reverse: typeof data.marginReverse === "number" ? data.marginReverse : undefined,
        },
        updatedAt: data.updatedAt?.toDate?.().toISOString?.() ?? null,
      });
    });

    const fallback = new Map(
      seed.rates.map((r) => [pairKey(r.from as CurrencyCode, r.to as CurrencyCode), r.marketPrice])
    );

    const rates = PAIRS.flatMap(({ a, b }) => {
      const key = pairKey(a, b);
      const entry = map.get(key);
      const marketPrice = entry?.marketPrice ?? fallback.get(key)!;
      return rowsForPair(
        a,
        b,
        marketPrice,
        defaultMargin,
        entry?.margins ?? {},
        entry?.updatedAt ?? null
      );
    });
    return { rates, defaultMargin };
  } catch {
    const defaultMargin = await getMarginPercent().catch(() => 2.5);
    return { rates: seedRows(defaultMargin), defaultMargin };
  }
}

/** Convenience wrapper for callers that only need the rate rows (the public
 *  site — Calculator, RateTicker, RatesTable). Admin should use
 *  getRatesWithMargin() instead to avoid fetching the margin twice. */
export async function getRates(): Promise<RateRow[]> {
  return (await getRatesWithMargin()).rates;
}

/** Writes one PAIR's market price (not a direction — a pair has exactly one).
 *  Called from the /admin panel only. Pass either side's currencies; it
 *  always resolves and stores under the pair's canonical key. Does NOT
 *  touch the pair's margin override — use setRouteMargin for that. */
export async function setMarketPrice(
  from: CurrencyCode,
  to: CurrencyCode,
  marketPrice: number
) {
  if (!firebaseEnabled || !db) {
    throw new Error("Firebase is not configured — see .env.example.");
  }
  const key = pairKey(from, to);
  await setDoc(
    doc(db, "rates", key),
    {
      from,
      to,
      marketPrice,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/** Sets (or clears) the margin override of ONE DIRECTION (from → to),
 *  independent of market price and of the opposite direction. Pass
 *  `percent: null` to remove the override so that direction falls back to
 *  the global default margin (Settings → margin in /admin). */
export async function setRouteMargin(from: CurrencyCode, to: CurrencyCode, percent: number | null) {
  if (!firebaseEnabled || !db) {
    throw new Error("Firebase is not configured — see .env.example.");
  }
  const key = pairKey(from, to);
  const field = isForwardDirection(from, to) ? "marginForward" : "marginReverse";
  await setDoc(doc(db, "rates", key), { [field]: percent === null ? deleteField() : percent }, { merge: true });
}

/** The saved price of every currency (units per 1 USDT) with the Binance
 *  ads behind it. Empty before the first update. */
export async function getUsdtPrices(): Promise<UsdtPrices> {
  if (!firebaseEnabled || !db) return {};
  try {
    const snap = await getDoc(doc(db, "settings", "usdtPrices"));
    return (snap.exists() ? snap.data().prices : null) ?? {};
  } catch {
    return {};
  }
}

export interface PairUpdate {
  from: CurrencyCode;
  to: CurrencyCode;
  marketPrice: number;
}

/** Writes new pair prices + today's history point for each. */
async function writePairs(pairs: { a: CurrencyCode; b: CurrencyCode; marketPrice: number }[]): Promise<PairUpdate[]> {
  await Promise.all(
    pairs.map(({ a, b, marketPrice }) =>
      Promise.all([setMarketPrice(a, b, marketPrice), appendRateHistory(a, b, marketPrice)])
    )
  );
  return pairs.map(({ a, b, marketPrice }) => ({ from: a, to: b, marketPrice }));
}

export interface FxUpdateResult {
  updated: PairUpdate[];
  prices: UsdtPrices;
  problems: string[];
}

/** "Update now" in /admin — same rules as the daily cron: Binance buy and
 *  sell for every currency (first 2 ads skipped, next 5 averaged), price =
 *  the middle of the two, then every pair rebuilt from those prices. Only
 *  touches prices, never margins. */
export async function updateRatesFromLiveFx(): Promise<FxUpdateResult> {
  if (!firebaseEnabled || !db) throw new Error("Firebase is not configured — see .env.example.");
  const res = await fetch("/api/fx", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.binance) throw new Error(data?.error ?? "تعذر جلب الأسعار من Binance");
  const prev = await getUsdtPrices();
  const { prices, problems } = buildUsdtPrices(prev, data as MarketData);
  await setDoc(doc(db, "settings", "usdtPrices"), { prices, updatedAt: serverTimestamp() });
  const updated = await writePairs(pairMarketPrices(prices));
  return { updated, prices, problems };
}

/** Replaces ONE currency's price by hand (e.g. a better rate was found that
 *  day) and rebuilds every pair that includes it. The Binance figures stay
 *  saved next to it for reference. The next update (daily or "update now")
 *  takes the Binance price again, except for USD cash / USD South Sudan,
 *  which keep a typed price until it is changed. */
export async function setUsdtPriceManual(
  code: CurrencyCode,
  used: number
): Promise<{ updated: PairUpdate[]; prices: UsdtPrices }> {
  if (!firebaseEnabled || !db) throw new Error("Firebase is not configured — see .env.example.");
  if (!(used > 0)) throw new Error("السعر لازم يكون أكبر من صفر");
  const prices = await getUsdtPrices();
  const before = prices[code];
  const entry: UsdtPrice = {
    used,
    buy: before?.buy ?? null,
    sell: before?.sell ?? null,
    buyAds: before?.buyAds ?? [],
    sellAds: before?.sellAds ?? [],
    source: "manual",
    at: new Date().toISOString(),
  };
  const next = { ...prices, [code]: entry };
  await setDoc(doc(db, "settings", "usdtPrices"), { prices: next, updatedAt: serverTimestamp() });
  const updated = await writePairs(pairMarketPrices(next, code));
  return { updated, prices: next };
}

/** Converts an amount between any two of Master Digital's currencies. Uses the
 *  direct pair if one exists; otherwise finds the shortest chain of pairs
 *  (e.g. MYR → SDG → USDT, or RUB → USDT → SDG → EGP). Returns null only if
 *  a required leg isn't priced — customer-facing math fails safe, not
 *  silently wrong. */
export function convertBetween(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rates: RateRow[]
): number | null {
  if (from === to) return amount;

  const neighbours = (c: CurrencyCode): CurrencyCode[] =>
    PAIRS.filter((p) => p.a === c || p.b === c).map((p) => (p.a === c ? p.b : p.a));

  // Breadth-first search for the shortest route through the corridor graph.
  const prev = new Map<CurrencyCode, CurrencyCode>();
  const queue: CurrencyCode[] = [from];
  const seen = new Set<CurrencyCode>([from]);
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const n of neighbours(cur)) {
      if (seen.has(n)) continue;
      seen.add(n);
      prev.set(n, cur);
      queue.push(n);
    }
  }
  if (!seen.has(to)) return null;

  const path: CurrencyCode[] = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);

  let amt = amount;
  for (let i = 0; i < path.length - 1; i++) {
    const legFrom = path[i];
    const legTo = path[i + 1];
    const row = rates.find((r) => r.from === legFrom && r.to === legTo);
    if (!row) return null;
    amt = isMultiplyCorridor(legFrom, legTo) ? amt * row.rate : amt / row.rate;
  }
  return amt;
}
