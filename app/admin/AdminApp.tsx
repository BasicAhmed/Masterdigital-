"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BellRing,
  FlaskConical,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Phone,
  Plus,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ThemeToggle";
import { demoMode } from "@/lib/store";
import { routesFromRates, usdRatesFromRoutes, type Route } from "@/lib/routes";
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
import {
  balances as computeBalances,
  deleteMovement,
  deleteObligation,
  getMovements,
  getObligations,
  liquidityLedger,
  saveMovement,
  saveObligation,
  type Balance,
  type LiquidityLine,
  type Movement,
  type Obligation,
} from "@/lib/books";
import {
  deleteAlert,
  deleteFeedback,
  getAlerts,
  getFeedback,
  isReached,
  saveAlert,
  saveFeedback,
  type Feedback,
  type RateAlert,
} from "@/lib/alerts";
import FinanceTab from "./FinanceTab";
import TransactionsTab from "./TransactionsTab";
import CustomersTab from "./CustomersTab";
import LedgerTab from "./LedgerTab";
import LiquidityTab from "./LiquidityTab";
import RatesTab from "./RatesTab";
import ContactTab from "./ContactTab";
import { AlertsTab, FeedbackTab } from "./InboxTabs";
import TransactionForm from "./TransactionForm";
import { Modal } from "./ui";

export type Tab = "finance" | "transactions" | "customers" | "ledger" | "liquidity" | "rates" | "alerts" | "feedback" | "contact";

const TABS: [Tab, string, typeof LayoutDashboard][] = [
  ["finance", "المالية", LayoutDashboard],
  ["transactions", "المعاملات", ArrowLeftRight],
  ["customers", "العملاء", Users],
  ["ledger", "الحسابات", HandCoins],
  ["liquidity", "السيولة", Wallet],
  ["rates", "الأسعار", TrendingUp],
  ["alerts", "تنبيهات الأسعار", BellRing],
  ["feedback", "الاقتراحات والشكاوى", MessageSquareText],
  ["contact", "التواصل", Phone],
];
/** The four a phone keeps one tap away; the rest sit behind "المزيد". */
const PRIMARY: Tab[] = ["finance", "transactions", "ledger", "liquidity"];

/** Everything the screens share. One copy of each record lives here, and
 *  every derived number (USD table, cash balances) is computed from it once —
 *  so the same figure can never differ between two pages. */
export interface AdminData {
  routes: Route[];
  usd: Record<string, number>;
  customers: Customer[];
  txs: Transaction[];
  obligations: Obligation[];
  movements: Movement[];
  liquidity: LiquidityLine[];
  balances: Balance[];
  alerts: RateAlert[];
  feedback: Feedback[];
  upsertCustomer: (c: Customer) => Promise<Customer>;
  removeCustomer: (id: string) => Promise<void>;
  upsertTx: (t: Transaction) => Promise<void>;
  removeTx: (id: string) => Promise<void>;
  upsertObligation: (o: Obligation) => Promise<void>;
  removeObligation: (id: string) => Promise<void>;
  upsertMovement: (m: Movement) => Promise<void>;
  removeMovement: (id: string) => Promise<void>;
  upsertAlert: (a: RateAlert) => Promise<void>;
  removeAlert: (id: string) => Promise<void>;
  upsertFeedback: (f: Feedback) => Promise<void>;
  removeFeedback: (id: string) => Promise<void>;
  openTxForm: (opts?: { customerId?: string; edit?: Transaction }) => void;
  goTo: (t: Tab) => void;
  onError: (msg: string) => void;
}

const put = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];

export default function AdminApp({ onSignOut, userEmail }: { onSignOut?: () => void; userEmail?: string }) {
  const [tab, setTab] = useState<Tab>("finance");
  const [loaded, setLoaded] = useState(false);
  // Rates come from the same source as the public site (market price + per-direction margin).
  const [rates, setRates] = useState<RateRow[]>([]);
  const [margin, setMargin] = useState(2.5);
  const [disabled, setDisabled] = useState<string[]>([]);
  const routes = useMemo<Route[]>(() => routesFromRates(rates, disabled), [rates, disabled]);
  const usd = useMemo(() => usdRatesFromRoutes(routes), [routes]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [alerts, setAlerts] = useState<RateAlert[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ customerId?: string; edit?: Transaction } | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    // Each list loads on its own: one failing collection must not blank the others.
    const safe = <T,>(p: Promise<T>, fallback: T) =>
      p.catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        return fallback;
      });
    Promise.all([
      safe(getRatesWithMargin(), { rates: [] as RateRow[], defaultMargin: 2.5 }),
      safe(getDisabledFlows(), [] as string[]),
      safe(getCustomers(), [] as Customer[]),
      safe(getTransactions(), [] as Transaction[]),
      safe(getObligations(), [] as Obligation[]),
      safe(getMovements(), [] as Movement[]),
      safe(getAlerts(), [] as RateAlert[]),
      safe(getFeedback(), [] as Feedback[]),
    ]).then(([r, flows, c, t, o, m, a, f]) => {
      setRates(r.rates);
      setMargin(r.defaultMargin);
      setDisabled(flows);
      setCustomers(c);
      setTxs(t);
      setObligations(o);
      setMovements(m);
      setAlerts(a);
      setFeedback(f);
      setLoaded(true);
    });
  }, []);

  // Whenever rates change (load, live update, margin edit), flag the alerts whose target is now met.
  useEffect(() => {
    if (!loaded || !rates.length) return;
    const hit = alerts.filter((a) => {
      if (a.status !== "active") return false;
      const row = rates.find((r) => r.from === a.from && r.to === a.to);
      return !!row && !disabled.includes(`${a.from}_${a.to}`) && isReached(a, row.rate);
    });
    if (!hit.length) return;
    const now = new Date().toISOString();
    const updated = hit.map((a) => ({
      ...a,
      status: "reached" as const,
      reachedAt: now,
      reachedRate: rates.find((r) => r.from === a.from && r.to === a.to)!.rate,
    }));
    setAlerts((prev) => prev.map((a) => updated.find((u) => u.id === a.id) ?? a));
    updated.forEach((u) => saveAlert(u).catch(() => undefined));
  }, [loaded, rates, disabled, alerts]);

  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, []);

  const liquidity = useMemo(() => liquidityLedger(txs, obligations, movements), [txs, obligations, movements]);
  const balances = useMemo(() => computeBalances(liquidity, usd), [liquidity, usd]);

  const data: AdminData = useMemo(
    () => ({
      routes,
      usd,
      customers,
      txs,
      obligations,
      movements,
      liquidity,
      balances,
      alerts,
      feedback,
      onError: setError,
      goTo: setTab,
      openTxForm: (opts) => setForm(opts ?? {}),
      upsertCustomer: (c) =>
        guard(async () => {
          await saveCustomer(c);
          setCustomers((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]));
          // keep the name shown on that customer's transactions and accounts in sync
          setTxs((prev) => prev.map((t) => (t.customerId === c.id && t.customerName !== c.name ? { ...t, customerName: c.name } : t)));
          setObligations((prev) => prev.map((o) => (o.customerId === c.id && o.party !== c.name ? { ...o, party: c.name } : o)));
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
          setTxs((prev) => put(prev, t).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)));
        }),
      removeTx: (id) =>
        guard(async () => {
          await deleteTransaction(id);
          setTxs((prev) => prev.filter((x) => x.id !== id));
        }),
      upsertObligation: (o) =>
        guard(async () => {
          await saveObligation(o);
          setObligations((prev) => put(prev, o));
        }),
      removeObligation: (id) =>
        guard(async () => {
          await deleteObligation(id);
          setObligations((prev) => prev.filter((x) => x.id !== id));
        }),
      upsertMovement: (m) =>
        guard(async () => {
          await saveMovement(m);
          setMovements((prev) => put(prev, m));
        }),
      removeMovement: (id) =>
        guard(async () => {
          await deleteMovement(id);
          setMovements((prev) => prev.filter((x) => x.id !== id));
        }),
      upsertAlert: (a) =>
        guard(async () => {
          await saveAlert(a);
          setAlerts((prev) => put(prev, a));
        }),
      removeAlert: (id) =>
        guard(async () => {
          await deleteAlert(id);
          setAlerts((prev) => prev.filter((x) => x.id !== id));
        }),
      upsertFeedback: (f) =>
        guard(async () => {
          await saveFeedback(f);
          setFeedback((prev) => put(prev, f));
        }),
      removeFeedback: (id) =>
        guard(async () => {
          await deleteFeedback(id);
          setFeedback((prev) => prev.filter((x) => x.id !== id));
        }),
    }),
    [routes, usd, customers, txs, obligations, movements, liquidity, balances, alerts, feedback, guard]
  );

  const badge: Partial<Record<Tab, number>> = {
    alerts: alerts.filter((a) => a.status === "reached").length,
    feedback: feedback.filter((f) => f.status === "new").length,
  };
  const moreBadge = TABS.filter(([v]) => !PRIMARY.includes(v)).reduce((s, [v]) => s + (badge[v] ?? 0), 0);
  const current = TABS.find(([v]) => v === tab)!;

  return (
    <div className="min-h-screen pb-28 lg:pb-12 lg:pr-64">
      {/* Desktop: navy sidebar */}
      <aside className="navy-field on-navy fixed inset-y-0 right-0 z-30 hidden w-64 flex-col overflow-y-auto p-5 lg:flex">
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
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                tab === value ? "bg-white text-[#06163a]" : "text-white/75 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon size={17} /> <span className="flex-1 text-right">{label}</span>
              {!!badge[value] && (
                <span className="num rounded-md bg-brand-gold px-1.5 py-0.5 text-[10px] font-bold text-[#06163a]">{badge[value]}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="relative mt-auto flex items-center justify-between gap-2 border-t border-white/15 pt-4">
          <div className="min-w-0">
            {userEmail && (
              <p className="truncate text-[11px] text-white/60" dir="ltr">
                {userEmail}
              </p>
            )}
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
        <Brand size={36} sub={current[1]} />
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
        <p className="num text-xs text-subtle" dir="ltr">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
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
            {!demoMode && " — تأكد من نشر قواعد Firestore الأخيرة."}
          </p>
        )}

        {!loaded ? (
          <div className="flex justify-center py-20">
            <RefreshCw size={20} className="animate-spin text-primary" />
          </div>
        ) : tab === "finance" ? (
          <FinanceTab data={data} />
        ) : tab === "transactions" ? (
          <TransactionsTab data={data} />
        ) : tab === "customers" ? (
          <CustomersTab data={data} />
        ) : tab === "ledger" ? (
          <LedgerTab data={data} />
        ) : tab === "liquidity" ? (
          <LiquidityTab data={data} />
        ) : tab === "rates" ? (
          <RatesTab state={{ rates, setRates, margin, setMargin, disabled, setDisabled }} onError={setError} />
        ) : tab === "alerts" ? (
          <AlertsTab data={data} />
        ) : tab === "feedback" ? (
          <FeedbackTab data={data} />
        ) : (
          <div className="mx-auto max-w-2xl">
            <ContactTab onError={setError} />
          </div>
        )}
      </main>

      {/* Mobile: quick-add button and tab bar */}
      <button
        onClick={() => setForm({})}
        aria-label="معاملة جديدة"
        className="btn-gold fixed bottom-[4.75rem] left-4 z-30 size-14 rounded-2xl shadow-lift lg:hidden"
      >
        <Plus size={24} />
      </button>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="أقسام النظام"
      >
        {TABS.filter(([v]) => PRIMARY.includes(v)).map(([value, label, Icon]) => (
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
        <button
          onClick={() => setMore(true)}
          className={`relative flex flex-col items-center gap-1 py-2.5 text-[10.5px] font-semibold ${!PRIMARY.includes(tab) ? "text-primary" : "text-subtle"}`}
        >
          <span className={`flex h-7 w-12 items-center justify-center rounded-lg ${!PRIMARY.includes(tab) ? "bg-primary/10" : ""}`}>
            <Menu size={18} />
          </span>
          المزيد
          {moreBadge > 0 && (
            <span className="num absolute right-1/2 top-1.5 translate-x-5 rounded-md bg-brand-gold px-1 text-[9px] font-bold text-[#06163a]">{moreBadge}</span>
          )}
        </button>
      </nav>

      {more && (
        <Modal title="كل الأقسام" onClose={() => setMore(false)}>
          <div className="grid grid-cols-2 gap-2">
            {TABS.map(([value, label, Icon]) => (
              <button
                key={value}
                onClick={() => {
                  setTab(value);
                  setMore(false);
                }}
                className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-right text-sm font-semibold ${
                  tab === value ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-ink"
                }`}
              >
                <Icon size={17} /> <span className="flex-1">{label}</span>
                {!!badge[value] && (
                  <span className="num rounded-md bg-brand-gold px-1.5 py-0.5 text-[10px] font-bold text-[#06163a]">{badge[value]}</span>
                )}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {form && <TransactionForm data={data} initialCustomerId={form.customerId} edit={form.edit} onClose={() => setForm(null)} />}
    </div>
  );
}
