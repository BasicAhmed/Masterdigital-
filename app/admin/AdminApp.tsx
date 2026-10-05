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

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Brand size={38} sub="نظام إدارة التحويلات" />
          <div className="flex items-center gap-2">
            <span className="hidden sm:block">
              <button onClick={() => setForm({})} className="btn-primary px-4 py-2.5 text-xs">
                <Plus size={15} /> معاملة جديدة
              </button>
            </span>
            <ThemeToggle />
            {onSignOut && (
              <button
                onClick={onSignOut}
                title={userEmail}
                aria-label="تسجيل الخروج"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted shadow-soft transition-colors hover:text-ink"
              >
                <LogOut size={14} /> <span className="hidden sm:inline">خروج</span>
              </button>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 sm:px-5" aria-label="أقسام النظام">
          {TABS.map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              aria-current={tab === value ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                tab === value ? "border-primary text-primary" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>
      </header>

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

      {/* Mobile: the main action is always one thumb away */}
      <div className="fixed inset-x-4 bottom-4 z-20 sm:hidden">
        <button onClick={() => setForm({})} className="btn-primary w-full py-3.5 text-sm shadow-lift">
          <Plus size={16} /> معاملة جديدة
        </button>
      </div>

      {form && <TransactionForm data={data} initialCustomerId={form.customerId} edit={form.edit} onClose={() => setForm(null)} />}
    </div>
  );
}
