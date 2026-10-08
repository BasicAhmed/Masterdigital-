import { CURRENCY_ORDER, PAIRS, USD_PEGGED, type CurrencyCode } from "./corridors";

/** Every price on the site starts from each currency's BUY and SELL price
 *  for 1 USDT. For the currencies below they come from Binance P2P, the same
 *  way for all of them: the BUY list and the SELL list are read, the first 2
 *  ads of each are skipped (often pinned or promoted, not a real price) and
 *  the next 5 are averaged. Staff can type their own buy and sell for any
 *  currency instead; a typed price stays until they switch back to Binance.
 *  The price used = the average of buy and sell, and every pair's market
 *  price is simply used(a) / used(b). */
export const BINANCE_FIATS: CurrencyCode[] = ["SDG", "UGX", "RWF", "KES", "EGP", "SAR", "AED"];

export const SKIP_ADS = 2;
export const USE_ADS = 5;

const USD_SOURCE_URL = "https://open.er-api.com/v6/latest/USD";
const BINANCE_P2P_URL = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

export type TradeSide = "BUY" | "SELL";

export interface P2PSide {
  avg: number;
  prices: number[]; // the ads that were averaged (#3 to #7)
}

export interface BinanceQuote {
  buy?: P2PSide; // ads where you BUY USDT with this currency
  sell?: P2PSide; // ads where you SELL USDT for this currency
  error?: string;
}

/** What the server hands back on every update: Binance's two sides per
 *  currency, plus the regular FX table used only as a last resort. */
export interface MarketData {
  binance: Partial<Record<CurrencyCode, BinanceQuote>>;
  fx: Record<string, number> | null;
  fxError?: string;
  at: string;
}

export type PriceSource = "binance" | "manual" | "fx" | "peg";

export const SOURCE_LABEL: Record<PriceSource, string> = {
  binance: "من Binance",
  manual: "سعر يدوي",
  fx: "سعر رسمي مؤقت",
  peg: "ثابت 1:1",
};

/** One currency: units of it per 1 USDT. */
export interface UsdtPrice {
  buy: number; // in force — Binance's, or typed by staff
  sell: number;
  used: number; // (buy + sell) / 2 — every rate is built from this
  source: PriceSource;
  at: string; // ISO time the price in force was set
  /** Latest Binance reading — refreshed on every update, even while a typed
   *  price is in force, so staff can compare and switch back. */
  binanceBuy: number | null;
  binanceSell: number | null;
  binanceAt: string | null;
  buyAds: number[]; // the ads behind binanceBuy (#3 to #7)
  sellAds: number[];
}

export type UsdtPrices = Partial<Record<CurrencyCode, UsdtPrice>>;

export const midOf = (buy: number, sell: number) => (buy + sell) / 2;

function fixed(value: number, source: PriceSource, at: string, keep?: UsdtPrice): UsdtPrice {
  return {
    buy: value,
    sell: value,
    used: value,
    source,
    at,
    binanceBuy: keep?.binanceBuy ?? null,
    binanceSell: keep?.binanceSell ?? null,
    binanceAt: keep?.binanceAt ?? null,
    buyAds: keep?.buyAds ?? [],
    sellAds: keep?.sellAds ?? [],
  };
}

/** Reads a saved entry, including ones saved by the earlier one-price version. */
export function normalizePrice(raw: any): UsdtPrice | undefined {
  if (!raw || !(raw.used > 0)) return undefined;
  const legacy = raw.binanceBuy === undefined;
  const wasManual = raw.source === "manual";
  const buy = legacy && wasManual ? raw.used : raw.buy ?? raw.used;
  const sell = legacy && wasManual ? raw.used : raw.sell ?? raw.used;
  return {
    buy,
    sell,
    used: midOf(buy, sell),
    source: raw.source ?? "binance",
    at: raw.at ?? new Date(0).toISOString(),
    binanceBuy: legacy ? (raw.source === "binance" || wasManual ? raw.buy ?? null : null) : raw.binanceBuy,
    binanceSell: legacy ? (raw.source === "binance" || wasManual ? raw.sell ?? null : null) : raw.binanceSell,
    binanceAt: legacy ? (raw.source === "binance" ? raw.at ?? null : null) : raw.binanceAt ?? null,
    buyAds: Array.isArray(raw.buyAds) ? raw.buyAds : [],
    sellAds: Array.isArray(raw.sellAds) ? raw.sellAds : [],
  };
}

export function normalizePrices(raw: any): UsdtPrices {
  const out: UsdtPrices = {};
  if (raw && typeof raw === "object") {
    for (const code of CURRENCY_ORDER) {
      const p = normalizePrice(raw[code]);
      if (p) out[code] = p;
    }
  }
  return out;
}

/** Puts a currency back on Binance's latest buy/sell, or — for USD cash and
 *  USD South Sudan, which Binance doesn't trade — back to 1:1. */
export function backToAuto(code: CurrencyCode, p: UsdtPrice | undefined, at: string): UsdtPrice | null {
  if (USD_PEGGED.includes(code)) return fixed(1, "peg", at);
  if (!p || p.binanceBuy == null || p.binanceSell == null) return null;
  return { ...p, buy: p.binanceBuy, sell: p.binanceSell, used: midOf(p.binanceBuy, p.binanceSell), source: "binance", at };
}

async function fetchUsdBaseRates(): Promise<Record<string, number>> {
  const res = await fetch(USD_SOURCE_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`مصدر أسعار الصرف رجّع HTTP ${res.status}`);
  const data = await res.json();
  if (data.result !== "success" || !data.rates) {
    throw new Error(`خطأ من مصدر أسعار الصرف: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return data.rates as Record<string, number>;
}

/** Binance P2P has no official public API — this is the same request
 *  Binance's own web page makes for its ad lists. */
async function fetchP2PSide(fiat: CurrencyCode, tradeType: TradeSide): Promise<P2PSide> {
  const res = await fetch(BINANCE_P2P_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      page: 1,
      rows: SKIP_ADS + USE_ADS,
      payTypes: [],
      asset: "USDT",
      tradeType,
      fiat,
      merchantCheck: false,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Binance رجّع HTTP ${res.status}`);
  const data = await res.json();
  const ads = data?.data;
  if (!Array.isArray(ads) || ads.length <= SKIP_ADS) {
    throw new Error(`ما في إعلانات كفاية في Binance (${Array.isArray(ads) ? ads.length : 0})`);
  }
  const prices = ads
    .slice(SKIP_ADS, SKIP_ADS + USE_ADS)
    .map((item: any) => parseFloat(item?.adv?.price))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  if (prices.length === 0) throw new Error("تعذر قراءة أسعار Binance");
  return { avg: prices.reduce((s: number, p: number) => s + p, 0) / prices.length, prices };
}

async function fetchQuote(fiat: CurrencyCode): Promise<BinanceQuote> {
  const [buy, sell] = await Promise.allSettled([fetchP2PSide(fiat, "BUY"), fetchP2PSide(fiat, "SELL")]);
  const q: BinanceQuote = {};
  if (buy.status === "fulfilled") q.buy = buy.value;
  if (sell.status === "fulfilled") q.sell = sell.value;
  if (!q.buy && !q.sell) {
    const reason = buy.status === "rejected" ? buy.reason : (sell as PromiseRejectedResult).reason;
    q.error = reason instanceof Error ? reason.message : String(reason);
  }
  return q;
}

/** Reads Binance for every currency (a few at a time, to stay polite) and the
 *  regular FX table, which is only used for a currency Binance can't price
 *  and that has no earlier price saved. */
export async function fetchMarketData(): Promise<MarketData> {
  const binance: MarketData["binance"] = {};
  const queue = [...BINANCE_FIATS];
  const worker = async () => {
    while (queue.length) {
      const fiat = queue.shift()!;
      binance[fiat] = await fetchQuote(fiat);
    }
  };
  const [fxResult] = await Promise.all([
    fetchUsdBaseRates().then(
      (fx) => ({ fx, fxError: undefined as string | undefined }),
      (err) => ({ fx: null, fxError: err instanceof Error ? err.message : String(err) })
    ),
    Promise.all([worker(), worker(), worker()]),
  ]);
  return { binance, fx: fxResult.fx, fxError: fxResult.fxError, at: new Date().toISOString() };
}

/** Pure: turns fresh market data + the saved prices into the new saved
 *  prices. Rules per currency:
 *  - USDT is the base: always 1.
 *  - USD cash / USD South Sudan: 1:1 unless staff typed a price.
 *  - A typed price stays in force; only its Binance reading is refreshed.
 *  - Otherwise Binance's buy and sell.
 *  - Binance failed → the earlier price stays.
 *  - Nothing earlier → the regular FX rate for now (never for SDG, whose
 *    official rate is far from the real one). */
export function buildUsdtPrices(prevRaw: UsdtPrices, data: MarketData): { prices: UsdtPrices; problems: string[] } {
  const prev = normalizePrices(prevRaw);
  const prices: UsdtPrices = {};
  const problems: string[] = [];
  for (const code of CURRENCY_ORDER) {
    const before = prev[code];
    if (code === "USDT") {
      prices[code] = fixed(1, "peg", data.at);
      continue;
    }
    if (USD_PEGGED.includes(code)) {
      prices[code] = before ?? fixed(1, "peg", data.at);
      continue;
    }
    const q = data.binance[code];
    const fresh =
      q && (q.buy || q.sell)
        ? {
            binanceBuy: q.buy?.avg ?? q.sell!.avg,
            binanceSell: q.sell?.avg ?? q.buy!.avg,
            binanceAt: data.at,
            buyAds: q.buy?.prices ?? [],
            sellAds: q.sell?.prices ?? [],
          }
        : null;
    if (fresh && (!q!.buy || !q!.sell)) problems.push(`${code}: جانب واحد بس من Binance`);

    if (before?.source === "manual") {
      prices[code] = fresh ? { ...before, ...fresh } : before;
      continue;
    }
    if (fresh) {
      prices[code] = {
        ...fresh,
        buy: fresh.binanceBuy,
        sell: fresh.binanceSell,
        used: midOf(fresh.binanceBuy, fresh.binanceSell),
        source: "binance",
        at: data.at,
      };
      continue;
    }
    const why = q?.error ?? "ما رجع رد";
    if (before) {
      prices[code] = before;
      problems.push(`${code}: Binance ما اشتغل (${why}) — السعر السابق باقي`);
    } else if (code !== "SDG" && data.fx?.[code]) {
      prices[code] = fixed(data.fx[code], "fx", data.at);
      problems.push(`${code}: Binance ما اشتغل (${why}) — سعر رسمي مؤقت`);
    } else {
      problems.push(`${code}: ما في سعر (${why})`);
    }
  }
  return { prices, problems };
}

/** Pure: a pair's market price ("units of a per 1 b") from the two prices.
 *  Pass `only` to get just the pairs that include that currency. */
export function pairMarketPrices(
  prices: UsdtPrices,
  only?: CurrencyCode
): { a: CurrencyCode; b: CurrencyCode; marketPrice: number }[] {
  return PAIRS.filter((p) => !only || p.a === only || p.b === only).flatMap(({ a, b }) => {
    const pa = prices[a]?.used;
    const pb = prices[b]?.used;
    return pa && pb ? [{ a, b, marketPrice: pa / pb }] : [];
  });
}
