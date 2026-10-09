import type { CurrencyCode } from "./currencies";
import { CURRENCY_LIST } from "./currencies";
import type { Transaction } from "./data";
import { listDocs, removeDoc, saveDoc, newId } from "./store";
import { toUsd } from "./calc";
import type { Stamped } from "./activity";

/** The business's books beyond single transfers: who owes whom (obligations)
 *  and how much cash is on hand in each currency (liquidity). Both are
 *  derived from records — nothing here is a number typed in twice. */

// ---------- Obligations: money owed to us / by us ----------

export type ObligationKind = "receivable" | "payable"; // لنا | علينا
export type PartyType = "person" | "company";

export interface ObligationPayment {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  note: string;
}

export interface Obligation extends Stamped {
  id: string;
  kind: ObligationKind;
  party: string; // person or company name
  partyType: PartyType;
  customerId: string; // "" when the party is not in the customer list
  currency: CurrencyCode;
  amount: number;
  date: string;
  dueDate: string; // "" = no due date
  note: string;
  /** true when the cash actually left / entered our funds when this was
   *  recorded (a loan given or received). false for credit that involved no
   *  cash yet. */
  cashMoved: boolean;
  payments: ObligationPayment[];
  createdAt: string;
}

export const KIND_LABEL: Record<ObligationKind, string> = { receivable: "لنا", payable: "علينا" };

export const getObligations = () => listDocs<Obligation>("obligations");
export const saveObligation = (o: Obligation) => saveDoc("obligations", o);
export const deleteObligation = (id: string) => removeDoc("obligations", id);

export function blankObligation(kind: ObligationKind = "receivable"): Obligation {
  return {
    id: newId(),
    kind,
    party: "",
    partyType: "person",
    customerId: "",
    currency: "USDT",
    amount: 0,
    date: "",
    dueDate: "",
    note: "",
    cashMoved: false,
    payments: [],
    createdAt: new Date().toISOString(),
  };
}

export const paidOf = (o: Obligation) => o.payments.reduce((s, p) => s + p.amount, 0);
export const remainingOf = (o: Obligation) => Math.max(0, o.amount - paidOf(o));
export const isSettled = (o: Obligation) => remainingOf(o) <= 1e-9;
export const isOverdue = (o: Obligation, today: string) => !isSettled(o) && !!o.dueDate && o.dueDate < today;

export interface CurrencyPosition {
  currency: CurrencyCode;
  receivable: number; // still owed to us
  payable: number; // we still owe
  net: number; // receivable − payable
}

/** Outstanding amounts per currency. */
export function positions(list: Obligation[]): CurrencyPosition[] {
  return CURRENCY_LIST.map((c) => {
    const mine = list.filter((o) => o.currency === c.code);
    const receivable = mine.filter((o) => o.kind === "receivable").reduce((s, o) => s + remainingOf(o), 0);
    const payable = mine.filter((o) => o.kind === "payable").reduce((s, o) => s + remainingOf(o), 0);
    return { currency: c.code, receivable, payable, net: receivable - payable };
  }).filter((p) => p.receivable || p.payable);
}

export interface PartyBalance {
  key: string;
  party: string;
  partyType: PartyType;
  customerId: string;
  receivableUsd: number;
  payableUsd: number;
  netUsd: number;
  open: number;
  byCurrency: { currency: CurrencyCode; net: number }[];
}

const partyKey = (o: Obligation) => o.customerId || `name:${o.party.trim().toLowerCase()}`;

/** Who owes whom: one line per party, netted, with a USD total for sorting. */
export function partyBalances(list: Obligation[], usd: Record<string, number>): PartyBalance[] {
  const map = new Map<string, Obligation[]>();
  for (const o of list) {
    const k = partyKey(o);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(o);
  }
  return Array.from(map.entries())
    .map(([key, items]) => {
      const sum = (kind: ObligationKind) =>
        items.filter((o) => o.kind === kind).reduce((s, o) => s + toUsd(remainingOf(o), o.currency, usd), 0);
      const receivableUsd = sum("receivable");
      const payableUsd = sum("payable");
      return {
        key,
        party: items[0].party,
        partyType: items[0].partyType,
        customerId: items[0].customerId,
        receivableUsd,
        payableUsd,
        netUsd: receivableUsd - payableUsd,
        open: items.filter((o) => !isSettled(o)).length,
        byCurrency: positions(items).map((p) => ({ currency: p.currency, net: p.net })),
      };
    })
    .filter((p) => p.open > 0)
    .sort((a, b) => Math.abs(b.netUsd) - Math.abs(a.netUsd));
}

// ---------- Liquidity: cash on hand per currency ----------

/** The places cash can sit inside one currency (الأصناف). A currency with no
 *  list here (USDT, USD cash, USD South Sudan) has a single balance. Ids are
 *  saved on records, so never rename or reuse an id — change the label. */
export interface AccountDef {
  id: string;
  label: string;
}

export const ACCOUNTS: Partial<Record<CurrencyCode, AccountDef[]>> = {
  UGX: [
    { id: "ugx-momo", label: "موبايل موني" },
    { id: "ugx-cash", label: "كاش في المكتب" },
    { id: "ugx-bank", label: "حساب البنك" },
  ],
  SDG: [
    { id: "sdg-bankak-1", label: "بنكك 1" },
    { id: "sdg-bankak-2", label: "بنكك 2" },
    { id: "sdg-bankak-3", label: "بنكك 3" },
  ],
  EGP: [
    { id: "egp-vodafone", label: "فودافون كاش" },
    { id: "egp-instapay", label: "انستا باي" },
  ],
  RWF: [{ id: "rwf-momo", label: "موبايل موني (Momo)" }],
  KES: [{ id: "kes-mpesa", label: "امبسا (M-Pesa)" }],
  SAR: [{ id: "sar-account", label: "ريال حساب" }],
  AED: [{ id: "aed-account", label: "درهم حساب" }],
};

/** Records saved before categories existed, or saved without one. */
export const UNASSIGNED = "";
export const UNASSIGNED_LABEL = "غير مصنّف";

export const accountsOf = (currency: CurrencyCode): AccountDef[] => ACCOUNTS[currency] ?? [];

export function accountLabel(currency: CurrencyCode, id: string | undefined): string {
  if (!id) return UNASSIGNED_LABEL;
  return accountsOf(currency).find((a) => a.id === id)?.label ?? UNASSIGNED_LABEL;
}

/** Keeps an id only if it belongs to this currency (else unassigned). */
export const validAccount = (currency: CurrencyCode, id: string | undefined): string =>
  accountsOf(currency).some((a) => a.id === id) ? (id as string) : UNASSIGNED;

export type MovementKind = "deposit" | "withdraw";

/** A manual change to the funds: opening balance, top-up, owner withdrawal,
 *  correction after a count. Everything else moves cash on its own. */
export interface Movement extends Stamped {
  id: string;
  date: string;
  currency: CurrencyCode;
  kind: MovementKind;
  amount: number;
  note: string;
  /** Category of that currency the cash went into / came out of. */
  account?: string;
  createdAt: string;
}

export const getMovements = () => listDocs<Movement>("movements");
export const saveMovement = (m: Movement) => saveDoc("movements", m);
export const deleteMovement = (id: string) => removeDoc("movements", id);

export interface LiquidityLine {
  date: string;
  currency: CurrencyCode;
  delta: number;
  source: "manual" | "transaction" | "obligation";
  label: string;
  refId: string;
  /** Category inside the currency ("" = unassigned). */
  account: string;
  /** Staff member who recorded the source record. */
  by?: string;
}

/** Every cash movement, from all three sources, as one ledger.
 *  - Completed transfer: + what the customer paid in, − what we paid out
 *    (and − any cost we carried).
 *  - Obligation: the principal when cash moved at creation, then each
 *    repayment (in for money owed to us, out for money we owe).
 *  - Manual deposits and withdrawals. */
export function liquidityLedger(txs: Transaction[], obligations: Obligation[], movements: Movement[]): LiquidityLine[] {
  const out: LiquidityLine[] = [];
  for (const m of movements) {
    out.push({
      date: m.date,
      currency: m.currency,
      delta: m.kind === "deposit" ? m.amount : -m.amount,
      source: "manual",
      label: m.note || (m.kind === "deposit" ? "إيداع" : "سحب"),
      refId: m.id,
      account: validAccount(m.currency, m.account),
      by: m.createdByName,
    });
  }
  for (const t of txs) {
    if (t.status !== "completed") continue;
    const paidIn = t.amount + (t.feeSide === "from" ? t.fee : 0);
    const inAccount = validAccount(t.from, t.fromAccount);
    const outAccount = validAccount(t.to, t.toAccount);
    out.push({ date: t.date, currency: t.from, delta: paidIn, source: "transaction", label: `${t.ref} — ${t.customerName}`, refId: t.id, account: inAccount, by: t.createdByName });
    out.push({ date: t.date, currency: t.to, delta: -t.payout, source: "transaction", label: `${t.ref} — ${t.customerName}`, refId: t.id, account: outAccount, by: t.createdByName });
    if (t.expense) {
      out.push({
        date: t.date,
        currency: t.expenseSide === "from" ? t.from : t.to,
        delta: -t.expense,
        source: "transaction",
        label: `${t.ref} — تكاليف`,
        refId: t.id,
        account: t.expenseSide === "from" ? inAccount : outAccount,
        by: t.createdByName,
      });
    }
  }
  for (const o of obligations) {
    const sign = o.kind === "receivable" ? 1 : -1; // repayments: in for receivable, out for payable
    if (o.cashMoved) {
      out.push({
        date: o.date,
        currency: o.currency,
        delta: -sign * o.amount,
        source: "obligation",
        label: `${o.kind === "receivable" ? "سلفة إلى" : "استلام من"} ${o.party}`,
        refId: o.id,
        account: UNASSIGNED,
        by: o.createdByName,
      });
    }
    for (const p of o.payments) {
      out.push({
        date: p.date,
        currency: o.currency,
        delta: sign * p.amount,
        source: "obligation",
        label: `${o.kind === "receivable" ? "سداد من" : "سداد إلى"} ${o.party}`,
        refId: o.id,
        account: UNASSIGNED,
        by: o.createdByName,
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Balance of one category inside a currency. */
export interface AccountBalance {
  id: string; // "" = unassigned
  label: string;
  balance: number;
}

export interface Balance {
  currency: CurrencyCode;
  balance: number;
  usd: number;
  inflow: number;
  outflow: number;
  /** Split of `balance` by category. Empty for currencies without
   *  categories; "غير مصنّف" only shows when something is in it. */
  accounts: AccountBalance[];
}

export function balances(lines: LiquidityLine[], usd: Record<string, number>): Balance[] {
  return CURRENCY_LIST.map((c) => {
    const mine = lines.filter((l) => l.currency === c.code);
    const balance = mine.reduce((s, l) => s + l.delta, 0);
    const defs = accountsOf(c.code);
    const accounts: AccountBalance[] = defs.map((d) => ({
      id: d.id,
      label: d.label,
      balance: mine.filter((l) => l.account === d.id).reduce((s, l) => s + l.delta, 0),
    }));
    if (defs.length) {
      const loose = mine.filter((l) => !l.account).reduce((s, l) => s + l.delta, 0);
      if (Math.abs(loose) > 1e-9) accounts.push({ id: UNASSIGNED, label: UNASSIGNED_LABEL, balance: loose });
    }
    return {
      currency: c.code,
      balance,
      usd: toUsd(balance, c.code, usd),
      inflow: mine.filter((l) => l.delta > 0).reduce((s, l) => s + l.delta, 0),
      outflow: mine.filter((l) => l.delta < 0).reduce((s, l) => s - l.delta, 0),
      accounts,
    };
  });
}
