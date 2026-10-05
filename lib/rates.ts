import { collection, getDocs, getDoc, doc, setDoc, deleteField, serverTimestamp } from "firebase/firestore";
import { db, firebaseEnabled } from "./firebase";
import { PAIRS, pairKey, isForwardDirection, isMultiplyCorridor, type CurrencyCode } from "./corridors";
import { getMarginPercent } from "./settings";
import { roundForDisplay } from "./format";
import { appendRateHistory } from "./rateHistory";
import seed from "@/data/rates.seed.json";

/** For SDG pairs only: the raw USDT/SDG data the marketPrice was derived
 *  from, so it can be shown in /admin for verification. */
export interface SdgSourceDetail {
  usdtToSdg: number; // the average used
  prices: number[]; // the individual Binance P2P offers averaged
}

export interface RateRow {
  from: CurrencyCode;
  to: CurrencyCode;
  marketPrice: number; // the pair's single true cross-rate, quoted a-per-b
  rate: number; // marketPrice adjusted by the profit margin — what customers see/get
  marginPercent: number; // the margin actually applied to THIS DIRECTION (its own override or the global default)
  marginOverride?: number; // set only if this direction has a custom margin; absent = using the global default
  updatedAt: string | null;
  sdgSource?: SdgSourceDetail;
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
  updatedAt: string | null,
  sdgSource?: SdgSourceDetail
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
      sdgSource,
    },
    {
      from: to,
      to: from,
      marketPrice,
      rate: computeRate(to, from, marketPrice, reverse),
      marginPercent: reverse,
      marginOverride: overrides.reverse,
      updatedAt,
      sdgSource,
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
        sdgSource?: SdgSourceDetail;
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
        sdgSource:
          typeof data.sdgUsdtToSdg === "number" && Array.isArray(data.sdgPrices)
            ? { usdtToSdg: data.sdgUsdtToSdg, prices: data.sdgPrices }
            : undefined,
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
        entry?.updatedAt ?? null,
        entry?.sdgSource
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
 *  always resolves and stores under the pair's canonical key. `sdgSource`
 *  is only meaningful for SDG pairs — stores the raw Binance P2P data the
 *  price came from, so /admin can show exactly what was used. Does NOT
 *  touch the pair's margin override — use setRouteMargin for that. */
export async function setMarketPrice(
  from: CurrencyCode,
  to: CurrencyCode,
  marketPrice: number,
  sdgSource?: SdgSourceDetail
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
      ...(sdgSource ? { sdgUsdtToSdg: sdgSource.usdtToSdg, sdgPrices: sdgSource.prices } : {}),
    },
    { merge: true }
  );
}

/** Manually overrides the shared USDT/SDG price used across every SDG
 *  pair (e.g. Ahmed found a cheaper source than Binance P2P that day).
 *  Rescales each SDG pair's stored marketPrice proportionally — the ratio
 *  of new-to-old USDT/SDG applies equally to all of them, since marketPrice
 *  = usdtToSdg / (other currency's USD rate), and the other currency's rate
 *  hasn't changed. Only rescales pairs that already have a baseline
 *  (sdgUsdtToSdg from a previous auto-update) — a pair that's never been
 *  auto-updated yet has nothing to rescale from, so it's left alone. */
export async function setSdgUsdtOverride(newUsdtToSdg: number): Promise<void> {
  if (!firebaseEnabled || !db) {
    throw new Error("Firebase is not configured — see .env.example.");
  }
  const sdgPairs = PAIRS.filter((p) => p.a === "SDG" || p.b === "SDG");

  const jobs = sdgPairs.map(async ({ a, b }) => {
    const key = pairKey(a, b);
    const snap = await getDoc(doc(db!, "rates", key));
    if (!snap.exists()) return;
    const data = snap.data();
    const oldMarketPrice = data.marketPrice;
    const oldUsdtToSdg = data.sdgUsdtToSdg;
    if (typeof oldMarketPrice !== "number" || typeof oldUsdtToSdg !== "number" || oldUsdtToSdg === 0) {
      return; // no baseline yet — leave this pair untouched
    }
    const newMarketPrice = oldMarketPrice * (newUsdtToSdg / oldUsdtToSdg);
    await setDoc(
      doc(db!, "rates", key),
      {
        from: a,
        to: b,
        marketPrice: newMarketPrice,
        updatedAt: serverTimestamp(),
        sdgUsdtToSdg: newUsdtToSdg,
        sdgPrices: [],
        source: "manual-override",
      },
      { merge: true }
    );
    await appendRateHistory(a, b, newMarketPrice);
  });

  await Promise.all(jobs);
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

export interface FxUpdateResult {
  updated: { from: CurrencyCode; to: CurrencyCode; marketPrice: number; sdgSource?: SdgSourceDetail }[];
  skipped: string[];
}

/** Client-side "update now" — same math and same sources as the daily cron
 *  (app/api/cron/update-rates), but runs on demand from a logged-in admin
 *  session using the normal authenticated client SDK instead of the service
 *  account. Pulls live rates via the same-origin /api/fx relay (avoids
 *  browser CORS issues) — that includes SDG via Binance P2P now, so every
 *  pair updates the same way; the raw SDG offers get stored too. Only
 *  touches market prices, never margin overrides. Returns each updated
 *  pair's new marketPrice/sdgSource so the caller can patch its own state
 *  directly instead of re-fetching the whole collection afterward. */
export async function updateRatesFromLiveFx(): Promise<FxUpdateResult> {
  const res = await fetch("/api/fx", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.rates) {
    throw new Error(data?.error ?? "تعذر جلب أسعار الصرف الحالية");
  }
  const usdRates = data.rates as Record<string, number>;
  const sdgSource: SdgSourceDetail | undefined = data.sdgDetail
    ? { usdtToSdg: data.sdgDetail.usdtToSdg, prices: data.sdgDetail.prices }
    : undefined;
  const rateFor = (code: CurrencyCode) => (code === "USDT" ? 1 : usdRates[code]);

  const updated: FxUpdateResult["updated"] = [];
  const skipped: string[] = [];

  const jobs = PAIRS.map(async ({ a, b }) => {
    const key = pairKey(a, b);
    const rateA = rateFor(a);
    const rateB = rateFor(b);
    if (!rateA || !rateB) {
      skipped.push(key);
      return;
    }
    const marketPrice = rateA / rateB;
    const involvesSdg = a === "SDG" || b === "SDG";
    const pairSdgSource = involvesSdg ? sdgSource : undefined;
    await Promise.all([
      setMarketPrice(a, b, marketPrice, pairSdgSource),
      appendRateHistory(a, b, marketPrice),
    ]);
    updated.push({ from: a, to: b, marketPrice, sdgSource: pairSdgSource });
  });

  await Promise.all(jobs);

  return { updated, skipped };
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
