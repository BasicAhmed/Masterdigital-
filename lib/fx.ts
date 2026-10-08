import { CURRENCY_ORDER, PAIRS, USD_PEGGED, type CurrencyCode } from "./corridors";

/** Every price on the site starts from ONE number per currency: how many units
 *  of it buy 1 USDT. For the currencies below that number comes from Binance
 *  P2P, the same way for all of them: the BUY list and the SELL list are read,
 *  the first 2 ads of each are skipped (they are often pinned or promoted and
 *  not a real price), the next 5 are averaged, and the price used is the
 *  middle of the buy and sell averages. Staff can replace any currency's price
 *  by hand in /admin. Every pair's market price is then simply
 *  price(a) / price(b). */
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
  binance: "Binance",
  manual: "يدوي",
  fx: "سعر رسمي (احتياطي)",
  peg: "ثابت 1:1",
};

/** One currency's price: units of it per 1 USDT. */
export interface UsdtPrice {
  used: number; // the price every rate is built from
  buy: number | null;
  sell: number | null;
  buyAds: number[];
  sellAds: number[];
  source: PriceSource;
  at: string; // ISO time it was set
}

export type UsdtPrices = Partial<Record<CurrencyCode, UsdtPrice>>;

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

/** Pure: turns fresh market data + the previously saved prices into the new
 *  saved prices. Rules per currency:
 *  - Binance answered → use it (middle of buy and sell, or the one side it gave).
 *  - Binance failed → keep the earlier price (Binance or hand-typed) as is.
 *  - Nothing earlier → the regular FX rate, except SDG whose official rate
 *    is far from the real one.
 *  - USDT, USD cash, USD South Sudan → 1, unless a price was typed by hand. */
export function buildUsdtPrices(prev: UsdtPrices, data: MarketData): { prices: UsdtPrices; problems: string[] } {
  const prices: UsdtPrices = {};
  const problems: string[] = [];
  for (const code of CURRENCY_ORDER) {
    const before = prev[code];
    if (USD_PEGGED.includes(code)) {
      prices[code] =
        before && before.source === "manual"
          ? before
          : { used: 1, buy: null, sell: null, buyAds: [], sellAds: [], source: "peg", at: data.at };
      continue;
    }
    const q = data.binance[code];
    if (q && (q.buy || q.sell)) {
      const sides = [q.buy?.avg, q.sell?.avg].filter((v): v is number => typeof v === "number");
      prices[code] = {
        used: sides.reduce((s, v) => s + v, 0) / sides.length,
        buy: q.buy?.avg ?? null,
        sell: q.sell?.avg ?? null,
        buyAds: q.buy?.prices ?? [],
        sellAds: q.sell?.prices ?? [],
        source: "binance",
        at: data.at,
      };
      if (!q.buy || !q.sell) problems.push(`${code}: جانب واحد بس من Binance`);
      continue;
    }
    const why = q?.error ?? "ما رجع رد";
    if (before) {
      prices[code] = before;
      problems.push(`${code}: Binance (${why}) — خلينا السعر السابق`);
    } else if (code !== "SDG" && data.fx?.[code]) {
      prices[code] = { used: data.fx[code], buy: null, sell: null, buyAds: [], sellAds: [], source: "fx", at: data.at };
      problems.push(`${code}: Binance (${why}) — استخدمنا السعر الرسمي`);
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
