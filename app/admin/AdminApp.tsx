"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, LayoutDashboard, LogOut, Phone, Plus, RefreshCw, TrendingUp, Users, FlaskConical } from "lucide-react";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ThemeToggle";
import { demoMode } from "@/lib/store";
import { routesFromRates, type Route } from "@/lib/routes";
import { getRatesWithMargin, type RateRow } from "@/lib/rates";
import { getDisabledFlows } from "@/lib/settings";
import {
  deleteCustomer,
  deleteTransaction,
  getCustomers,
  getTransactions,
  saveCustomer,
  saveTransaction,
  type Customer,
  type Transaction,
} from "@/lib/data";
import FinanceTab from "./FinanceTab";
import TransactionsTab from "./TransactionsTab";
import CustomersTab from "./CustomersTab";
import RatesTab from "./RatesTab";
import ContactTab from "./ContactTab";
import TransactionForm from "./TransactionForm";

type Tab = "finance" | "transactions" | "customers" | "rates" | "contact";

const TABS: [Tab, string, typeof LayoutDashboard][] = [
  ["finance", "المالية", LayoutDashboard],
  ["transactions", "المعاملات", ArrowLeftRight],
  ["customers", "العملاء", Users],
  ["rates", "الأسعار", TrendingUp],
  ["contact", "التواصل", Phone],
];

export interface AdminData {
  routes: Route[];
  customers: Customer[];
  txs: Transaction[];
  upsertCustomer: (c: Customer) => Promise<Customer>;
  removeCustomer: (id: string) => Promise<void>;
  upsertTx: (t: Transaction) => Promise<void>;
  removeTx: (id: string) => Promise<void>;
  openTxForm: (opts?: { customerId?: string; edit?: Transaction }) => void;
  onError: (msg: string) => void;
}

export default function AdminApp({ onSignOut, userEmail }: { onSignOut?: () => void; userEmail?: string }) {
  const [tab, setTab] = useState<Tab>("finance");
  const [loaded, setLoaded] = useState(false);
  // Rates come from the same source as the public site (market price + per-direction margin).
  const [rates, setRates] = useState<RateRow[]>([]);
  const [margin, setMargin] = useState(2.5);
  const [disabled, setDisabled] = useState<string[]>([]);
  const routes = useMemo<Route[]>(() => routesFromRates(rates, disabled), [rates, disabled]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ customerId?: string; edit?: Transaction } | null>(null);

  useEffect(() => {
    Promise.all([getRatesWithMargin(), getDisabledFlows(), getCustomers(), getTransactions()])
      .then(([r, flows, c, t]) => {
        setRates(r.rates);
        setMargin(r.defaultMargin);
        setDisabled(flows);
        setCustomers(c);
        setTxs(t);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoaded(true));
  }, []);

  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, []);

  const data: AdminData = useMemo(
    () => ({
      routes,
      customers,
      txs,
      onError: setError,
      openTxForm: (opts) => setForm(opts ?? {}),
      upsertCustomer: (c) =>
        guard(async () => {
          await saveCustomer(c);
          setCustomers((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]));
          // keep the name shown on that customer's transactions in sync
          setTxs((prev) => prev.map((t) => (t.customerId === c.id && t.customerName !== c.name ? { ...t, customerName: c.name } : t)));
          return c;
        }),
      removeCustomer: (id) =>
        guard(async () => {
          await deleteCustomer(id);
          setCustomers((prev) => prev.filter((x) => x.id !== id));
        }),
      upsertTx: (t) =>
        guard(async () => {
          await saveTransaction(t);
          setTxs((prev) =>
            (prev.some((x) => x.id === t.id) ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev]).sort((a, b) =>
              (b.date + b.createdAt).localeCompare(a.date + a.createdAt)
            )
          );
        }),
      removeTx: (id) =>
        guard(async () => {
          await deleteTransaction(id);
          setTxs((prev) => prev.filter((x) => x.id !== id));
        }),
    }),
    [routes, customers, txs, guard]
  );

  const current = TABS.find(([v]) => v === tab)!;

  return (
    <div className="min-h-screen pb-28 lg:pb-12 lg:pr-64">
      {/* Desktop: navy sidebar */}
      <aside className="navy-field on-navy fixed inset-y-0 right-0 z-30 hidden w-64 flex-col p-5 lg:flex">
        <div aria-hidden="true" className="shield-lines pointer-events-none absolute inset-0" />
        <div className="relative">
          <Brand size={42} sub="نظام إدارة التحويلات" />
        </div>
        <button onClick={() => setForm({})} className="btn-gold relative mt-7 w-full py-3 text-sm">
          <Plus size={16} /> معاملة جديدة
        </button>
        <nav className="relative mt-6 flex flex-col gap-1" aria-label="أقسام النظام">
          {TABS.map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              aria-current={tab === value ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                tab === value ? "bg-white text-[#06163a]" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>
        <div className="relative mt-auto flex items-center justify-between gap-2 border-t border-white/15 pt-4">
          <div className="min-w-0">
            {userEmail && <p className="truncate text-[11px] text-white/60" dir="ltr">{userEmail}</p>}
            {onSignOut && (
              <button onClick={onSignOut} className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-white/85 hover:text-white">
                <LogOut size={13} /> تسجيل الخروج
              </button>
            )}
          </div>
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile: slim top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-surface/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <Brand size={36} sub="نظام إدارة التحويلات" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {onSignOut && (
            <button onClick={onSignOut} aria-label="تسجيل الخروج" className="flex size-9 items-center justify-center rounded-xl border border-border text-muted">
              <LogOut size={15} />
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto hidden max-w-6xl items-end justify-between px-6 pt-8 lg:flex">
        <h1 className="font-display text-2xl font-extrabold text-ink">{current[1]}</h1>
        <p className="num text-xs text-subtle" dir="ltr">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <main className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        {demoMode && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-ink">
            <FlaskConical size={15} className="mt-0.5 shrink-0 text-amber-500" />
            <span>
              <b>وضع تجريبي:</b> Firebase غير مُفعّل، فالبيانات محفوظة على هذا المتصفح فقط وبدون تسجيل دخول. أضف مفاتيح
              Firebase في Vercel (راجع <code dir="ltr">.env.example</code>) عشان البيانات تتشارك بين الموظفين وتتأمّن.
            </span>
          </p>
        )}
        {error && (
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
            حصل خطأ: {error}
            {!demoMode && " — تأكد من نشر قواعد Firestore."}
          </p>
        )}

        {!loaded ? (
          <div className="flex justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-primary" />
          </div>
        ) : tab === "finance" ? (
          <FinanceTab data={data} goTo={(t) => setTab(t)} />
        ) : tab === "transactions" ? (
          <TransactionsTab data={data} />
        ) : tab === "customers" ? (
          <CustomersTab data={data} />
        ) : tab === "rates" ? (
          <RatesTab state={{ rates, setRates, margin, setMargin, disabled, setDisabled }} onError={setError} />
        ) : (
          <div className="mx-auto max-w-2xl">
            <ContactTab onError={setError} />
          </div>
        )}
      </main>

      {/* Mobile: tab bar with the main action in the middle of the thumb zone */}
      <button
        onClick={() => setForm({})}
        aria-label="معاملة جديدة"
        className="btn-gold fixed bottom-[4.75rem] left-4 z-30 size-14 rounded-2xl shadow-lift lg:hidden"
      >
        <Plus size={24} />
      </button>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="أقسام النظام">
        {TABS.map(([value, label, Icon]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            aria-current={tab === value ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold ${tab === value ? "text-primary" : "text-subtle"}`}
          >
            <span className={`flex h-7 w-12 items-center justify-center rounded-lg ${tab === value ? "bg-primary/10" : ""}`}>
              <Icon size={18} />
            </span>
            {label}
          </button>
        ))}
      </nav>

      {form && <TransactionForm data={data} initialCustomerId={form.customerId} edit={form.edit} onClose={() => setForm(null)} />}
    </div>
  );
}
