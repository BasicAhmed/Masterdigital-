import type { CurrencyCode } from "./currencies";
import { usdTable } from "./calc";
import type { RateRow } from "./rates";

/** One DIRECTION as the transaction form sees it — built from the site's own
 *  rate rows, never stored separately. `rate` is the customer rate, `cost`
 *  is the pair's market price; the gap between them is that route's margin. */
export interface Route {
  id: string; // "SDG_USDT"
  from: CurrencyCode;
  to: CurrencyCode;
  cost: number;
  rate: number;
  marginPercent: number;
  active: boolean;
  updatedAt: string | null;
}

export function routesFromRates(rates: RateRow[], disabledFlows: string[]): Route[] {
  return rates.map((r) => ({
    id: `${r.from}_${r.to}`,
    from: r.from,
    to: r.to,
    cost: r.marketPrice,
    rate: r.rate,
    marginPercent: r.marginPercent,
    active: !disabledFlows.includes(`${r.from}_${r.to}`),
    updatedAt: r.updatedAt,
  }));
}

/** Units of each currency per 1 USD, from the routes' market prices (USDT = 1 USD). */
export function usdRatesFromRoutes(routes: Route[]): Record<string, number> {
  return usdTable(Object.fromEntries(routes.map((r) => [r.id, r.cost])));
}
