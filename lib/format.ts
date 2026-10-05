import { CURRENCIES, type CurrencyCode } from "./currencies";

export function fmt(value: number, maxDecimals = 0): string {
  if (!isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}

/** Amount in a currency, with that currency's usual decimals. */
export function fmtMoney(value: number, code: CurrencyCode | string): string {
  const d = CURRENCIES[code as CurrencyCode]?.decimals ?? 2;
  return fmt(value, d);
}

export function fmtUsd(value: number): string {
  const abs = Math.abs(value);
  return `\u200e${value < 0 ? "-" : ""}$${fmt(abs, abs >= 1000 ? 0 : 2)}\u200e`;
}

/** Board rates: whole numbers when big, a few decimals when small. */
export function fmtRate(value: number): string {
  if (!value || !isFinite(value)) return "—";
  const abs = Math.abs(value);
  return fmt(value, abs >= 1000 ? 0 : abs >= 10 ? 2 : 4);
}

export function fmtPct(value: number, d = 2): string {
  return `\u200e${isFinite(value) ? value.toFixed(d) : "0"}%\u200e`;
}

export function todayStr(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "100000.5" → "100,000.5" while typing. */
export function formatTyping(raw: string) {
  if (!raw) return "";
  const [int, dec] = raw.split(".");
  const intFmt = int ? Number(int).toLocaleString("en-US") : "0";
  return dec !== undefined ? `${intFmt}.${dec}` : intFmt;
}
export function cleanNumber(v: string, decimals = 4) {
  const clean = v.replace(/[^0-9.]/g, "");
  const [int, ...rest] = clean.split(".");
  const next = rest.length ? `${int}.${rest.join("").slice(0, decimals)}` : int;
  return next.replace(/^0+(?=\d)/, "");
}
