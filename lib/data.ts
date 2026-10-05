import type { CurrencyCode } from "./currencies";
import type { FeeSide } from "./calc";
import { listDocs, removeDoc, saveDoc, newId } from "./store";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  country: string;
  notes: string;
  createdAt: string;
}

export type TxStatus = "completed" | "pending" | "cancelled";

export const STATUS_LABEL: Record<TxStatus, string> = {
  completed: "مكتملة",
  pending: "قيد التنفيذ",
  cancelled: "ملغاة",
};

export const PAYMENT_METHODS = ["بنكك", "USDT", "Vodafone Cash", "M-Pesa", "MTN Mobile Money", "كاش", "تحويل بنكي"];

/** A logged transfer. Every calculated figure is frozen at save time —
 *  later rate changes never rewrite history. */
export interface Transaction {
  id: string;
  ref: string;
  date: string; // YYYY-MM-DD
  customerId: string;
  customerName: string;
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number; // in `from`
  rate: number; // customer rate, board convention
  cost: number; // cost rate, board convention
  fee: number;
  feeSide: FeeSide;
  expense: number;
  expenseSide: FeeSide;
  payout: number; // customer receives, in `to`
  marginPercent: number;
  volumeUsd: number;
  revenueUsd: number;
  profitUsd: number;
  payMethod: string; // how the customer paid
  payoutMethod: string; // how the recipient was paid
  recipient: string;
  status: TxStatus;
  notes: string;
  createdAt: string;
}

export const getCustomers = () => listDocs<Customer>("customers");
export const saveCustomer = (c: Customer) => saveDoc("customers", c);
export const deleteCustomer = (id: string) => removeDoc("customers", id);

export async function getTransactions(): Promise<Transaction[]> {
  const all = await listDocs<Transaction>("transactions");
  return all.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
}
export const saveTransaction = (t: Transaction) => saveDoc("transactions", t);
export const deleteTransaction = (id: string) => removeDoc("transactions", id);

export function blankCustomer(): Customer {
  return { id: newId(), name: "", phone: "", country: "", notes: "", createdAt: new Date().toISOString() };
}

/** MD-251005-007 — date + running number for that day. */
export function nextRef(date: string, existing: Transaction[]): string {
  const stamp = date.replace(/-/g, "").slice(2);
  const prefix = `MD-${stamp}-`;
  const max = existing
    .filter((t) => t.ref.startsWith(prefix))
    .reduce((m, t) => Math.max(m, parseInt(t.ref.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
