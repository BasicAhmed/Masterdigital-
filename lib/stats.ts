import type { Customer, Transaction } from "./data";
import { todayStr } from "./format";

export type PeriodKey = "today" | "7d" | "month" | "lastMonth" | "year" | "all" | "custom";

export const PERIODS: [PeriodKey, string][] = [
  ["today", "اليوم"],
  ["7d", "آخر 7 أيام"],
  ["month", "هذا الشهر"],
  ["lastMonth", "الشهر الماضي"],
  ["year", "هذه السنة"],
  ["all", "الكل"],
  ["custom", "فترة محددة"],
];

export function periodRange(key: PeriodKey, custom?: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  const today = todayStr(now);
  const d = (y: number, m: number, day: number) => todayStr(new Date(y, m, day));
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "7d":
      return { from: d(now.getFullYear(), now.getMonth(), now.getDate() - 6), to: today };
    case "month":
      return { from: d(now.getFullYear(), now.getMonth(), 1), to: today };
    case "lastMonth":
      return { from: d(now.getFullYear(), now.getMonth() - 1, 1), to: d(now.getFullYear(), now.getMonth(), 0) };
    case "year":
      return { from: d(now.getFullYear(), 0, 1), to: today };
    case "custom":
      return { from: custom?.from || "0000-00-00", to: custom?.to || "9999-12-31" };
    default:
      return { from: "0000-00-00", to: "9999-12-31" };
  }
}

export const inRange = (t: Transaction, r: { from: string; to: string }) => t.date >= r.from && t.date <= r.to;

export interface Totals {
  count: number;
  volume: number;
  revenue: number;
  profit: number;
  margin: number; // profit / volume %
  avgProfit: number;
  avgTicket: number;
}

/** Money totals count COMPLETED transactions only — pending and cancelled
 *  ones are reported separately so they never inflate revenue or profit. */
export function totals(txs: Transaction[]): Totals {
  const done = txs.filter((t) => t.status === "completed");
  const volume = done.reduce((s, t) => s + t.volumeUsd, 0);
  const revenue = done.reduce((s, t) => s + t.revenueUsd, 0);
  const profit = done.reduce((s, t) => s + t.profitUsd, 0);
  return {
    count: done.length,
    volume,
    revenue,
    profit,
    margin: volume ? (profit / volume) * 100 : 0,
    avgProfit: done.length ? profit / done.length : 0,
    avgTicket: done.length ? volume / done.length : 0,
  };
}

export interface GroupRow extends Totals {
  key: string;
  label: string;
}

export function groupBy(txs: Transaction[], keyOf: (t: Transaction) => string, labelOf?: (t: Transaction) => string): GroupRow[] {
  const map = new Map<string, { label: string; items: Transaction[] }>();
  for (const t of txs) {
    if (t.status !== "completed") continue;
    const k = keyOf(t);
    if (!map.has(k)) map.set(k, { label: labelOf ? labelOf(t) : k, items: [] });
    map.get(k)!.items.push(t);
  }
  return Array.from(map.entries()).map(([key, v]) => ({ key, label: v.label, ...totals(v.items) }));
}

/** One point per day for the last `days` days (zero-filled). */
export function dailySeries(txs: Transaction[], days: number): { date: string; profit: number; volume: number; count: number }[] {
  const now = new Date();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = todayStr(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    const t = totals(txs.filter((x) => x.date === date));
    out.push({ date, profit: t.profit, volume: t.volume, count: t.count });
  }
  return out;
}

export function monthlySeries(txs: Transaction[], months: number): (Totals & { month: string })[] {
  const now = new Date();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = todayStr(d).slice(0, 7);
    out.push({ month, ...totals(txs.filter((x) => x.date.startsWith(month))) });
  }
  return out;
}

export interface CustomerStat extends Totals {
  customer: Customer;
  lastDate: string | null;
  allCount: number;
}

export function customerStats(customers: Customer[], txs: Transaction[]): CustomerStat[] {
  const by = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (!by.has(t.customerId)) by.set(t.customerId, []);
    by.get(t.customerId)!.push(t);
  }
  return customers.map((customer) => {
    const mine = by.get(customer.id) ?? [];
    return {
      customer,
      ...totals(mine),
      allCount: mine.length,
      lastDate: mine.reduce<string | null>((m, t) => (!m || t.date > m ? t.date : m), null),
    };
  });
}
