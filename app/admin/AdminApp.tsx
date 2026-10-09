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
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ThemeToggle";
import { demoMode } from "@/lib/store";
import { can as canDo, getStaff, type Me, type Perm, type StaffMember } from "@/lib/staff";
import { getActivity, logActivity, onActivity, setActor, stamp, type Activity } from "@/lib/activity";
import { fmtMoney } from "@/lib/format";
import { STATUS_LABEL as TX_STATUS } from "@/lib/data";
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
import TeamTab from "./TeamTab";
import { Modal } from "./ui";

export type Tab = "finance" | "transactions" | "customers" | "ledger" | "liquidity" | "rates" | "alerts" | "feedback" | "contact" | "team";

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
  ["team", "الفريق", UserCog],
];

/** Which permission opens which section. The owner sees everything. */
const TAB_PERM: Record<Tab, (me: Me) => boolean> = {
  finance: (me) => canDo(me, "finance"),
  transactions: (me) => canDo(me, "tx_add") || canDo(me, "tx_edit"),
  customers: (me) => canDo(me, "customers") || canDo(me, "tx_add"),
  ledger: (me) => canDo(me, "ledger"),
  liquidity: (me) => canDo(me, "liquidity"),
  rates: (me) => canDo(me, "rates"),
  alerts: (me) => canDo(me, "inbox"),
  feedback: (me) => canDo(me, "inbox"),
  contact: (me) => canDo(me, "contact"),
  team: (me) => me.role === "owner" || canDo(me, "activity"),
};
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
  me: Me;
  can: (p: Perm) => boolean;
  /** May this person change / delete this transaction? */
  canEditTx: (t: Transaction) => boolean;
  staff: StaffMember[];
  setStaff: (fn: (prev: StaffMember[]) => StaffMember[]) => void;
  activity: Activity[];
  reloadActivity: () => Promise<void>;
  upsertCustomer: (c: Customer) => Promise<Customer>;
  /** Saves many customers (an import), a few at a time. */
  importCustomers: (list: Customer[], onProgress?: (done: number) => void) => Promise<void>;
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

export default function AdminApp({ me, onSignOut }: { me: Me; onSignOut?: () => void }) {
  const can = useCallback((p: Perm) => canDo(me, p), [me]);
  const tabs = useMemo(() => TABS.filter(([v]) => TAB_PERM[v](me)), [me]);
  const [tab, setTab] = useState<Tab>(() => TABS.find(([v]) => TAB_PERM[v](me))?.[0] ?? "transactions");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const seesTeam = TAB_PERM.team(me);

  // Every action from now on is signed with this person's name.
  useEffect(() => {
    setActor({ uid: me.uid, name: me.name });
    onActivity((a) => setActivity((prev) => [a, ...prev]));
    return () => {
      setActor(null);
      onActivity(null);
    };
  }, [me]);

  const reloadActivity = useCallback(async () => {
    if (!seesTeam) return;
    const [a, s] = await Promise.all([getActivity().catch(() => [] as Activity[]), getStaff().catch(() => [] as StaffMember[])]);
    setActivity(a);
    setStaff(s);
  }, [seesTeam]);
  useEffect(() => {
    reloadActivity();
  }, [reloadActivity]);
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
      // only load what this person may read — no false "permission" errors
      canDo(me, "inbox") ? safe(getAlerts(), [] as RateAlert[]) : Promise.resolve([] as RateAlert[]),
      canDo(me, "inbox") ? safe(getFeedback(), [] as Feedback[]) : Promise.resolve([] as Feedback[]),
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
    if (!loaded || !rates.length || !canDo(me, "inbox")) return;
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
  }, [loaded, rates, disabled, alerts, me]);

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
      me,
      can,
      canEditTx: (t) => can("tx_edit") || (can("tx_add") && !!t.createdBy && t.createdBy === me.uid),
      staff,
      setStaff,
      activity,
      reloadActivity,
      onError: setError,
      goTo: setTab,
      openTxForm: (opts) => setForm(opts ?? {}),
      upsertCustomer: (input) =>
        guard(async () => {
          const before = customers.find((x) => x.id === input.id);
          const c = stamp(input, !before);
          await saveCustomer(c);
          logActivity({ kind: "customer", action: before ? "update" : "create", refId: c.id, summary: `${before ? "تعديل" : "إضافة"} العميل ${c.name}${c.code != null ? ` #${c.code}` : ""}` });
          setCustomers((prev) => (prev.some((x) => x.id === c.id) ? prev.map((x) => (x.id === c.id ? c : x)) : [...prev, c]));
          // keep the name shown on that customer's transactions and accounts in sync
          setTxs((prev) => prev.map((t) => (t.customerId === c.id && t.customerName !== c.name ? { ...t, customerName: c.name } : t)));
          setObligations((prev) => prev.map((o) => (o.customerId === c.id && o.party !== c.name ? { ...o, party: c.name } : o)));
          return c;
        }),
      importCustomers: (list, onProgress) =>
        guard(async () => {
          const queue = list.map((c) => stamp(c, !customers.some((x) => x.id === c.id)));
          const savedList: Customer[] = [];
          const worker = async () => {
            while (queue.length) {
              const c = queue.shift()!;
              await saveCustomer(c);
              savedList.push(c);
              onProgress?.(savedList.length);
            }
          };
          try {
            await Promise.all([worker(), worker(), worker(), worker(), worker()]);
          } finally {
            // show whatever got saved, even if the import stopped half way
            const saved = new Map(savedList.map((c) => [c.id, c]));
            if (savedList.length) logActivity({ kind: "customer", action: "import", summary: `استيراد ${savedList.length} عميل من ملف` });
            setCustomers((prev) => [...prev.map((x) => saved.get(x.id) ?? x), ...Array.from(saved.values()).filter((c) => !prev.some((x) => x.id === c.id))]);
          }
        }),
      removeCustomer: (id) =>
        guard(async () => {
          await deleteCustomer(id);
          logActivity({ kind: "customer", action: "delete", refId: id, summary: `حذف العميل ${customers.find((x) => x.id === id)?.name ?? ""}` });
          setCustomers((prev) => prev.filter((x) => x.id !== id));
        }),
      upsertTx: (input) =>
        guard(async () => {
          const before = txs.find((x) => x.id === input.id);
          const t = stamp(input, !before);
          await saveTransaction(t);
          const what = `${t.ref}: ${fmtMoney(t.amount, t.from)} ${t.from} → ${t.to} — ${t.customerName}`;
          logActivity({
            kind: "transaction",
            action: before ? "update" : "create",
            refId: t.id,
            summary: !before
              ? `معاملة جديدة ${what}`
              : before.status !== t.status
                ? `${t.ref}: الحالة من «${TX_STATUS[before.status]}» إلى «${TX_STATUS[t.status]}»`
                : `تعديل المعاملة ${what}`,
          });
          setTxs((prev) => put(prev, t).sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt)));
        }),
      removeTx: (id) =>
        guard(async () => {
          const t = txs.find((x) => x.id === id);
          await deleteTransaction(id);
          logActivity({ kind: "transaction", action: "delete", refId: id, summary: `حذف المعاملة ${t ? `${t.ref} — ${t.customerName}` : ""}` });
          setTxs((prev) => prev.filter((x) => x.id !== id));
        }),
      upsertObligation: (input) =>
        guard(async () => {
          const before = obligations.find((x) => x.id === input.id);
          const o = stamp(input, !before);
          await saveObligation(o);
          const paid = before && o.payments.length > before.payments.length ? o.payments[o.payments.length - 1] : null;
          logActivity({
            kind: "obligation",
            action: before ? "update" : "create",
            refId: o.id,
            summary: paid
              ? `سداد ${fmtMoney(paid.amount, o.currency)} ${o.currency} — ${o.party}`
              : `${before ? "تعديل" : "تسجيل"} مستحق ${o.kind === "receivable" ? "لنا" : "علينا"}: ${fmtMoney(o.amount, o.currency)} ${o.currency} — ${o.party}`,
          });
          setObligations((prev) => put(prev, o));
        }),
      removeObligation: (id) =>
        guard(async () => {
          const o = obligations.find((x) => x.id === id);
          await deleteObligation(id);
          logActivity({ kind: "obligation", action: "delete", refId: id, summary: `حذف مستحق ${o ? `— ${o.party}` : ""}` });
          setObligations((prev) => prev.filter((x) => x.id !== id));
        }),
      upsertMovement: (input) =>
        guard(async () => {
          const before = movements.find((x) => x.id === input.id);
          const m = stamp(input, !before);
          await saveMovement(m);
          logActivity({ kind: "movement", action: before ? "update" : "create", refId: m.id, summary: `${m.kind === "deposit" ? "إيداع" : "سحب"} ${fmtMoney(m.amount, m.currency)} ${m.currency}${m.note ? ` — ${m.note}` : ""}` });
          setMovements((prev) => put(prev, m));
        }),
      removeMovement: (id) =>
        guard(async () => {
          const m = movements.find((x) => x.id === id);
          await deleteMovement(id);
          logActivity({ kind: "movement", action: "delete", refId: id, summary: `حذف حركة سيولة ${m ? `${fmtMoney(m.amount, m.currency)} ${m.currency}` : ""}` });
          setMovements((prev) => prev.filter((x) => x.id !== id));
        }),
      upsertAlert: (a) =>
        guard(async () => {
          await saveAlert(a);
          logActivity({ kind: "alert", action: "update", refId: a.id, summary: `تنبيه سعر ${a.from} → ${a.to}: ${a.status === "notified" ? "تم إبلاغ العميل" : a.status}` });
          setAlerts((prev) => put(prev, a));
        }),
      removeAlert: (id) =>
        guard(async () => {
          await deleteAlert(id);
          logActivity({ kind: "alert", action: "delete", refId: id, summary: "حذف تنبيه سعر" });
          setAlerts((prev) => prev.filter((x) => x.id !== id));
        }),
      upsertFeedback: (f) =>
        guard(async () => {
          await saveFeedback(f);
          logActivity({ kind: "feedback", action: "update", refId: f.id, summary: f.status === "handled" ? "تم التعامل مع رسالة" : "إعادة فتح رسالة" });
          setFeedback((prev) => put(prev, f));
        }),
      removeFeedback: (id) =>
        guard(async () => {
          await deleteFeedback(id);
          logActivity({ kind: "feedback", action: "delete", refId: id, summary: "حذف رسالة" });
          setFeedback((prev) => prev.filter((x) => x.id !== id));
        }),
    }),
    [routes, usd, customers, txs, obligations, movements, liquidity, balances, alerts, feedback, guard, me, can, staff, activity, reloadActivity]
  );

  const badge: Partial<Record<Tab, number>> = {
    alerts: alerts.filter((a) => a.status === "reached").length,
    feedback: feedback.filter((f) => f.status === "new").length,
    team: me.role === "owner" ? staff.filter((x) => x.status === "pending").length : 0,
  };
  const moreBadge = tabs.filter(([v]) => !PRIMARY.includes(v)).reduce((s, [v]) => s + (badge[v] ?? 0), 0);
  const current = tabs.find(([v]) => v === tab) ?? tabs[0] ?? TABS[1];
  // never render a section this person may not open
  const shown: Tab | null = tabs.length ? current[0] : null;

  return (
    <div className="min-h-screen pb-28 lg:pb-12 lg:pr-64">
      {/* Desktop: navy sidebar */}
      <aside className="navy-field on-navy fixed inset-y-0 right-0 z-30 hidden w-64 flex-col overflow-y-auto p-5 lg:flex">
        <div aria-hidden="true" className="shield-lines pointer-events-none absolute inset-0" />
        <div className="relative">
          <Brand size={42} sub="نظام إدارة التحويلات" />
        </div>
        {can("tx_add") && (
          <button onClick={() => setForm({})} className="btn-gold relative mt-7 w-full py-3 text-sm">
            <Plus size={16} /> معاملة جديدة
          </button>
        )}
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
            <p className="truncate text-xs font-semibold text-white">
              {me.name} <span className="font-normal text-white/60">· {me.role === "owner" ? "المالك" : "موظف"}</span>
            </p>
            {me.email && (
              <p className="truncate text-[11px] text-white/60" dir="ltr">
                {me.email}
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
        {me.legacy && (
          <p className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-ink">
            <b>الصلاحيات لسه ما اتفعّلت:</b> انشر قواعد Firestore الجديدة (ملف <code dir="ltr">firestore.rules</code>) في Firebase → Firestore → Rules،
            وبعدها سجّل خروج ودخول عشان تبقى المالك.
          </p>
        )}
        {tabs.length === 0 && <p className="py-16 text-center text-sm text-muted">ما عندك صلاحية لأي قسم — تواصل مع المالك.</p>}
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
        ) : shown === "finance" ? (
          <FinanceTab data={data} />
        ) : shown === "transactions" ? (
          <TransactionsTab data={data} />
        ) : shown === "customers" ? (
          <CustomersTab data={data} />
        ) : shown === "ledger" ? (
          <LedgerTab data={data} />
        ) : shown === "liquidity" ? (
          <LiquidityTab data={data} />
        ) : shown === "rates" ? (
          <RatesTab state={{ rates, setRates, margin, setMargin, disabled, setDisabled }} onError={setError} />
        ) : shown === "alerts" ? (
          <AlertsTab data={data} />
        ) : shown === "feedback" ? (
          <FeedbackTab data={data} />
        ) : shown === "team" ? (
          <TeamTab data={data} />
        ) : shown === "contact" ? (
          <div className="mx-auto max-w-2xl">
            <ContactTab onError={setError} />
          </div>
        ) : null}
      </main>

      {/* Mobile: quick-add button and tab bar */}
      {can("tx_add") && (
        <button
          onClick={() => setForm({})}
          aria-label="معاملة جديدة"
          className="btn-gold fixed bottom-[4.75rem] left-4 z-30 size-14 rounded-2xl shadow-lift lg:hidden"
        >
          <Plus size={24} />
        </button>
      )}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="أقسام النظام"
      >
        {tabs.filter(([v]) => PRIMARY.includes(v)).map(([value, label, Icon]) => (
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
            {tabs.map(([value, label, Icon]) => (
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
