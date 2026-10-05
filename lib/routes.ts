import { PAIRS, ROUTE_KEYS, findPair, routeKey, type CurrencyCode } from "./currencies";
import { marginOf, rateFromMargin, roundRate, usdTable } from "./calc";
import { listDocs, saveDoc } from "./store";
import seed from "@/data/routes.seed.json";

/** One DIRECTION of a pair. SDG→USDT and USDT→SDG are two separate routes,
 *  each with its own cost, margin and customer rate. */
export interface Route {
  id: string; // "SDG_USDT"
  from: CurrencyCode;
  to: CurrencyCode;
  cost: number; // what this exchange costs the business (board convention)
  rate: number; // what the customer gets (board convention)
  active: boolean;
  updatedAt: string | null;
}

export function seedRoutes(): Route[] {
  return seed.pairs.flatMap((p) => {
    const mid = (p.sell + p.buy) / 2;
    const base = p.base as CurrencyCode;
    const quote = p.quote as CurrencyCode;
    return [
      { id: routeKey(base, quote), from: base, to: quote, cost: mid, rate: p.sell, active: true, updatedAt: null },
      { id: routeKey(quote, base), from: quote, to: base, cost: mid, rate: p.buy, active: true, updatedAt: null },
    ];
  });
}

/** All 18 routes: stored values where they exist, seed values otherwise. */
export async function getRoutes(): Promise<Route[]> {
  const fallback = seedRoutes();
  let stored: Route[] = [];
  try {
    stored = await listDocs<Route>("routes");
  } catch {
    return fallback;
  }
  const map = new Map(stored.map((r) => [r.id, r]));
  return fallback.map((f) => {
    const s = map.get(f.id);
    if (!s || typeof s.rate !== "number" || typeof s.cost !== "number") return f;
    return { ...f, cost: s.cost, rate: s.rate, active: s.active !== false, updatedAt: s.updatedAt ?? null };
  });
}

export async function saveRoute(route: Route): Promise<Route> {
  return saveDoc("routes", { ...route, updatedAt: new Date().toISOString() });
}

export function routeMargin(r: Route): number {
  return marginOf(r.from, r.to, r.cost, r.rate);
}

export function costMap(routes: Route[]): Record<string, number> {
  return Object.fromEntries(routes.map((r) => [r.id, r.cost]));
}

export function usdRatesFromRoutes(routes: Route[]): Record<string, number> {
  return usdTable(costMap(routes));
}

/** Pulls live market prices and resets every route's COST to market, keeping
 *  each route's own margin % (so customer rates follow the market while every
 *  direction keeps the profit it was given). */
export async function refreshCostsFromMarket(routes: Route[]): Promise<{ routes: Route[]; skipped: string[] }> {
  const res = await fetch("/api/fx", { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.rates) throw new Error(data?.error ?? "تعذر جلب أسعار السوق");
  const usd = data.rates as Record<string, number>;
  const per = (c: CurrencyCode) => (c === "USDT" ? 1 : usd[c]);
  const skipped: string[] = [];
  const next: Route[] = [];
  for (const r of routes) {
    const p = findPair(r.from, r.to)!;
    const b = per(p.base);
    const q = per(p.quote);
    if (!b || !q) {
      if (!skipped.includes(`${p.base}/${p.quote}`)) skipped.push(`${p.base}/${p.quote}`);
      next.push(r);
      continue;
    }
    const cost = roundRate((q / b) * p.unit);
    const rate = roundRate(rateFromMargin(r.from, r.to, cost, routeMargin(r)));
    next.push(await saveRoute({ ...r, cost, rate }));
  }
  return { routes: next, skipped };
}

export { PAIRS, ROUTE_KEYS };
