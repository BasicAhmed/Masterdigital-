"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeftRight, Check, ChevronLeft, ChevronRight, Lock, Search, Sparkles, UserPlus, X } from "lucide-react";
import { CURRENCIES, CURRENCY_LIST, destinationsFor, routeKey, type CurrencyCode } from "@/lib/currencies";
import { findPair as findCorridor } from "@/lib/corridors";
import { computeTx, perUnit, rateFromAmounts, type FeeSide } from "@/lib/calc";
import { fmtMoney, fmtRate, fmtUsd, todayStr } from "@/lib/format";
import { blankCustomer, nextCustomerCode, nextRef, PAYMENT_METHODS, STATUS_LABEL, type Customer, type Transaction, type TxStatus } from "@/lib/data";
import { newId } from "@/lib/store";
import { accountsOf, validAccount } from "@/lib/books";
import type { AdminData } from "./AdminApp";
import { Field, NumInput } from "./ui";

const num = (s: string) => parseFloat(s) || 0;

type Step = 0 | 1 | 2 | 3;
const STEPS: { label: string }[] = [{ label: "العميل" }, { label: "المسار" }, { label: "المبالغ" }, { label: "التفاصيل" }];

/** How far the agreed deal sits from the website price, as a track the
 *  marker slides along. Inside the band = normal, outside = check it. */
function RateGauge({ diffPct }: { diffPct: number }) {
  const span = 8; // the track shows −8% … +8%
  const clamped = Math.max(-span, Math.min(span, diffPct));
  // RTL: "better for the customer" (positive) sits on the left
  const left = 50 - (clamped / span) * 50;
  const far = Math.abs(diffPct) > 3;
  return (
    <div className="px-1">
      <div className="relative h-2 rounded-full bg-surface2">
        <div className="absolute inset-y-0 rounded-full bg-emerald-500/20" style={{ left: `${50 - (3 / span) * 50}%`, right: `${50 - (3 / span) * 50}%` }} />
        <div className="absolute inset-y-[-3px] left-1/2 w-px bg-ink/40" />
        <motion.div
          className={`absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-soft ${far ? "bg-amber-500" : "bg-brand-navy dark:bg-primary"}`}
          animate={{ left: `${left}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-subtle">
        <span>أحسن لينا</span>
        <span className="font-semibold text-muted">سعر الموقع</span>
        <span>أحسن للعميل</span>
      </div>
    </div>
  );
}

function Tile({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-right text-sm font-semibold transition-colors disabled:opacity-35 ${
        on ? "border-brand-navy bg-brand-navy text-white dark:border-primary dark:bg-primary" : "border-border bg-surface text-ink hover:border-primary/60"
      }`}
    >
      {children}
    </button>
  );
}

function Chips({ value, options, onChange }: { value: string; options: { id: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id || "none"}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o.id ? "border-brand-navy bg-brand-navy text-white dark:border-primary dark:bg-primary" : "border-border bg-surface text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function TransactionForm({
  data,
  initialCustomerId,
  edit,
  onClose,
}: {
  data: AdminData;
  initialCustomerId?: string;
  edit?: Transaction;
  onClose: () => void;
}) {
  const { routes, customers, txs } = data;
  const reduceMotion = useReducedMotion();
  // Editing jumps straight to the amounts; a customer picked from their page skips step 1.
  const [step, setStep] = useState<Step>(edit ? 2 : initialCustomerId ? 1 : 0);
  const [reached, setReached] = useState<Step>(edit ? 3 : initialCustomerId ? 1 : 0);
  const [dir, setDir] = useState(1);

  const [customerId, setCustomerId] = useState<string | null>(edit?.customerId ?? initialCustomerId ?? null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Customer>(blankCustomer());

  const [date, setDate] = useState(edit?.date ?? todayStr());
  const [ref, setRef] = useState(edit?.ref ?? "");
  const [from, setFrom] = useState<CurrencyCode>(edit?.from ?? "SDG");
  const [to, setTo] = useState<CurrencyCode>(edit?.to ?? "UGX");
  const routeOf = (f: CurrencyCode, t: CurrencyCode) => routes.find((r) => r.id === routeKey(f, t));
  /** Cost of a route from what his money really cost him (liquidity
   *  average per currency, or the market where he has none). Read-only:
   *  staff never type it. */
  const costOf = (f: CurrencyCode, t: CurrencyCode): number | undefined => {
    const p = findCorridor(f, t);
    const x = p && data.costUsd[p.a];
    const y = p && data.costUsd[p.b];
    return x && y ? +(x / y).toPrecision(6) : routeOf(f, t)?.cost;
  };
  // Staff type BOTH amounts; the rate is worked out from them.
  const [amount, setAmount] = useState(edit ? String(edit.amount) : "");
  const [received, setReceived] = useState(edit ? String(edit.payout) : "");
  const [confirmLoss, setConfirmLoss] = useState(false);
  const [cost, setCost] = useState(edit?.cost ?? costOf(edit?.from ?? "SDG", edit?.to ?? "UGX") ?? 0);
  const [fee, setFee] = useState(edit?.fee ? String(edit.fee) : "");
  const [feeSide, setFeeSide] = useState<FeeSide>(edit?.feeSide ?? "to");
  const [expense, setExpense] = useState(edit?.expense ? String(edit.expense) : "");
  const [expenseSide, setExpenseSide] = useState<FeeSide>(edit?.expenseSide ?? "to");
  const [payMethod, setPayMethod] = useState(edit?.payMethod ?? "");
  const [payoutMethod, setPayoutMethod] = useState(edit?.payoutMethod ?? "");
  const [recipient, setRecipient] = useState(edit?.recipient ?? "");
  const [fromAccount, setFromAccount] = useState(edit?.fromAccount ?? "");
  const [toAccount, setToAccount] = useState(edit?.toAccount ?? "");
  const [status, setStatus] = useState<TxStatus>(edit?.status ?? "completed");
  const [notes, setNotes] = useState(edit?.notes ?? "");
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const sentRef = useRef<HTMLDivElement>(null);

  // Staff without the finance permission don't see cost, revenue or profit.
  const money = data.can("finance");
  const customer = customers.find((c) => c.id === customerId) ?? null;
  const route = routeOf(from, to);
  const usd = data.costUsd; // profit in dollars with his own rates (÷ rate of the received currency)
  const autoRef = useMemo(() => nextRef(date, txs), [date, txs]);

  // Fees only exist on deals saved before both amounts were typed.
  const legacyFee = !!edit?.fee;
  const feeNow = legacyFee ? num(fee) : 0;
  const gross = num(received) + (legacyFee && feeSide === "to" ? feeNow : 0);
  const rate = rateFromAmounts(from, to, num(amount), gross);
  const sitePer = route ? perUnit(from, to, route.rate) : 0; // units of `to` per 1 `from` on the website
  const diffPct = sitePer && num(amount) && gross ? ((gross / num(amount) - sitePer) / sitePer) * 100 : 0;
  const decimalsTo = CURRENCIES[to]?.decimals ?? 2;
  const siteAmount = sitePer && num(amount) ? Math.floor(num(amount) * sitePer * Math.pow(10, decimalsTo)) / Math.pow(10, decimalsTo) : 0;

  const calc = computeTx({ from, to, amount: num(amount), rate, cost, fee: feeNow, feeSide, expense: num(expense), expenseSide, usd });
  const both = num(amount) > 0 && num(received) > 0;
  const isLoss = both && calc.profitUsd < -1e-9;

  const toBalance = data.balances.find((b) => b.currency === to);
  const payoutAccount = validAccount(to, toAccount);
  const wasHere = !!edit && edit.status === "completed" && edit.to === to && validAccount(to, edit.toAccount) === payoutAccount;
  const available =
    (payoutAccount ? toBalance?.accounts.find((a) => a.id === payoutAccount)?.balance ?? 0 : toBalance?.balance ?? 0) + (wasHere ? edit!.payout : 0);
  const short = both && status === "completed" && calc.payout > available + 1e-9;

  function pickRoute(f: CurrencyCode, t: CurrencyCode) {
    setFrom(f);
    setTo(t);
    setFromAccount((a: string) => validAccount(f, a));
    setToAccount((a: string) => validAccount(t, a));
    if (t !== to) setReceived(""); // an amount in the old currency means nothing now
    setConfirmLoss(false);
    setCost(costOf(f, t) ?? 0);
  }

  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: Customer[] = [];
    for (const t of txs) {
      if (seen.has(t.customerId)) continue;
      seen.add(t.customerId);
      const c = customers.find((x) => x.id === t.customerId);
      if (c) out.push(c);
      if (out.length === 6) break;
    }
    return out;
  }, [txs, customers]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const d = q.replace(/\D/g, "");
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || (d && c.phone.replace(/\D/g, "").includes(d)) || (d && String(c.code ?? "") === d))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"))
      .slice(0, 30);
  }, [customers, query]);

  async function createCustomer() {
    if (!draft.name.trim()) return;
    const c = await data.upsertCustomer({ ...draft, name: draft.name.trim(), phone: draft.phone.trim() });
    setCreating(false);
    setDraft(blankCustomer());
    setQuery("");
    choose(c.id);
  }

  const canNext: Record<Step, boolean> = {
    0: !!customer,
    1: !!route,
    2: both && !!rate && (!isLoss || confirmLoss),
    3: true,
  };

  function go(next: Step) {
    setProblem(null);
    setDir(next > step ? 1 : -1);
    setStep(next);
    setReached((r) => (next > r ? next : r));
  }
  function choose(id: string) {
    setCustomerId(id);
    go(1);
  }

  // focus the "sent" box when the amounts step opens
  useEffect(() => {
    if (step === 2) setTimeout(() => sentRef.current?.querySelector("input")?.focus(), 250);
  }, [step]);

  async function save() {
    setProblem(null);
    if (!customer) return go(0);
    if (!both) return go(2);
    if (!cost) return setProblem("ما في سعر تكلفة للمسار ده — حدّث الأسعار أو سجّل إيداع بسعر.");
    if (isLoss && !confirmLoss) return go(2);
    const finalRef = ref.trim() || autoRef;
    if (txs.some((t) => t.ref === finalRef && t.id !== edit?.id)) return setProblem(`المرجع ${finalRef} مستخدم في معاملة تانية.`);
    setSaving(true);
    try {
      await data.upsertTx({
        id: edit?.id ?? newId(),
        ref: finalRef,
        date,
        customerId: customer.id,
        customerName: customer.name,
        from,
        to,
        amount: num(amount),
        rate,
        cost,
        fee: feeNow,
        feeSide,
        expense: num(expense),
        expenseSide,
        payout: calc.payout,
        marginPercent: calc.marginPercent,
        volumeUsd: calc.volumeUsd,
        revenueUsd: calc.revenueUsd,
        profitUsd: calc.profitUsd,
        payMethod,
        payoutMethod,
        recipient: recipient.trim(),
        fromAccount: validAccount(from, fromAccount),
        toAccount: validAccount(to, toAccount),
        status,
        notes: notes.trim(),
        createdAt: edit?.createdAt ?? new Date().toISOString(),
      });
      onClose();
    } catch {
      setSaving(false);
    }
  }

  // Escape closes; Enter moves on when the step is complete.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement) && !creating) {
        if (step < 3 && canNext[step]) {
          e.preventDefault();
          go((step + 1) as Step);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  });

  const methodOptions = [{ id: "", label: "—" }, ...PAYMENT_METHODS.map((m) => ({ id: m, label: m }))];
  const accountOptions = (c: CurrencyCode) => [{ id: "", label: "غير مصنّف" }, ...accountsOf(c).map((a) => ({ id: a.id, label: a.label }))];
  const sideChips = (value: FeeSide, onChange: (v: FeeSide) => void) => (
    <Chips value={value} onChange={(v) => onChange(v as FeeSide)} options={[{ id: "to", label: to }, { id: "from", label: from }]} />
  );

  const variants = {
    enter: (d: number) => ({ x: reduceMotion ? 0 : d * -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: reduceMotion ? 0 : d * 40, opacity: 0 }),
  };

  /* ---------------------------------- steps ---------------------------------- */

  const stepCustomer = (
    <div className="space-y-4">
      {creating ? (
        <div className="space-y-3">
          <Field label="اسم العميل *">
            <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="field px-3 py-3 text-base" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="رقم الهاتف">
              <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} dir="ltr" inputMode="tel" className="field px-3 py-2.5 font-mono text-sm" />
            </Field>
            <Field label="الدولة">
              <input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} className="field px-3 py-2.5 text-sm" />
            </Field>
          </div>
          <div className="flex gap-2">
            <button onClick={createCustomer} disabled={!draft.name.trim()} className="btn-primary flex-1 py-3 text-sm">
              <Check size={15} /> حفظ واختيار
            </button>
            <button onClick={() => setCreating(false)} className="btn-ghost px-4 py-3 text-sm">
              رجوع
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اسم العميل، رقمه أو هاتفه…"
              className="field py-3.5 pl-3 pr-10 text-base"
            />
          </div>
          {query.trim() ? (
            <ul className="max-h-64 divide-y divide-border/50 overflow-y-auto rounded-2xl border border-border/70">
              {matches.map((c) => (
                <li key={c.id}>
                  <button onClick={() => choose(c.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-primary/5">
                    <span className="truncate font-medium text-ink">
                      {c.code != null && <span className="num ml-1.5 text-xs text-subtle">#{c.code}</span>}
                      {c.name}
                    </span>
                    <span className="num shrink-0 text-xs text-subtle" dir="ltr">
                      {c.phone}
                    </span>
                  </button>
                </li>
              ))}
              {matches.length === 0 && <li className="px-4 py-5 text-center text-sm text-subtle">ما في عميل بالاسم ده.</li>}
            </ul>
          ) : (
            recent.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-muted">آخر العملاء</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {recent.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => choose(c.id)}
                      className={`truncate rounded-xl border px-3 py-2.5 text-right text-sm font-semibold transition-colors ${
                        c.id === customerId ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-ink hover:border-primary/60"
                      }`}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}
          <button
            onClick={() => {
              const digits = /\d{5,}/.test(query);
              setDraft({ ...blankCustomer(nextCustomerCode(customers)), name: digits ? "" : query.trim(), phone: digits ? query.trim() : "" });
              setCreating(true);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
          >
            <UserPlus size={15} /> عميل جديد{query.trim() && !/\d{5,}/.test(query) ? `: ${query.trim()}` : ""}
          </button>
        </>
      )}
    </div>
  );

  const stepRoute = (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs text-muted">العميل بيدفع</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CURRENCY_LIST.map((c) => (
            <Tile key={c.code} on={from === c.code} onClick={() => pickRoute(c.code, destinationsFor(c.code).includes(to) && to !== c.code ? to : destinationsFor(c.code)[0])}>
              <span className="text-lg">{c.flag}</span>
              <span className="num" dir="ltr">
                {c.code}
              </span>
            </Tile>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <button
          onClick={() => pickRoute(to, from)}
          aria-label="عكس المسار"
          className="flex size-10 items-center justify-center rounded-full border border-border bg-surface text-primary shadow-soft hover:border-primary/60"
        >
          <ArrowLeftRight size={16} className="rotate-90" />
        </button>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div>
        <p className="mb-2 text-xs text-muted">المستلم بياخد</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CURRENCY_LIST.map((c) => (
            <Tile key={c.code} on={to === c.code} disabled={c.code === from} onClick={() => pickRoute(from, c.code)}>
              <span className="text-lg">{c.flag}</span>
              <span className="num" dir="ltr">
                {c.code}
              </span>
            </Tile>
          ))}
        </div>
      </div>
      {route && (
        <p className="rounded-xl bg-surface2 px-3.5 py-2.5 text-xs text-muted">
          سعر الموقع اليوم: <b className="num text-ink" dir="ltr">1 {from} = {fmtRate(perUnit(from, to, route.rate))} {to}</b>
          {!route.active && <span className="mr-2 font-semibold text-amber-600">· المسار مقفول في صفحة الأسعار</span>}
        </p>
      )}
    </div>
  );

  const stepAmounts = (
    <div className="space-y-4">
      {/* The exchange slip — the two agreed amounts */}
      <div className="result-well on-navy text-white" style={{ boxShadow: "inset 0 2px 0 #c9a227" }}>
        <div ref={sentRef} className="px-5 pb-4 pt-5">
          <p className="flex items-center gap-2 text-xs text-white/70">
            <span className="text-base">{CURRENCIES[from].flag}</span> العميل دفع
          </p>
          <div className="mt-1 flex items-baseline gap-2" dir="ltr">
            <div className="min-w-0 flex-1 border-b border-white/15 pb-1 transition-colors focus-within:border-brand-gold">
            <NumInput
              value={amount}
              onChange={(v) => {
                setAmount(v);
                setConfirmLoss(false);
              }}
              decimals={2}
              placeholder="0"
              ariaLabel={`المبلغ المرسل بالـ ${from}`}
              className="!border-0 !bg-transparent !p-0 !text-4xl !font-bold !text-white !shadow-none !ring-0 placeholder:!text-white/30"
            />
            </div>
            <span className="num text-lg font-semibold text-brand-gold">{from}</span>
          </div>
        </div>
        <div className="relative mx-4 border-t-2 border-dashed border-brand-gold/50">
          <span className="absolute -top-3 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full bg-brand-gold text-[#06163a]">
            <ChevronLeft size={14} className="-rotate-90" />
          </span>
        </div>
        <div className="px-5 pb-5 pt-5">
          <p className="flex items-center justify-between gap-2 text-xs text-white/70">
            <span className="flex items-center gap-2">
              <span className="text-base">{CURRENCIES[to].flag}</span> المستلم ياخد
            </span>
            {siteAmount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setReceived(String(siteAmount));
                  setConfirmLoss(false);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1 font-semibold text-brand-gold hover:bg-white/15"
              >
                <Sparkles size={12} /> سعر الموقع: <span className="num" dir="ltr">{fmtMoney(siteAmount, to)}</span>
              </button>
            )}
          </p>
          <div className="mt-1 flex items-baseline gap-2" dir="ltr">
            <div className="min-w-0 flex-1 border-b border-white/15 pb-1 transition-colors focus-within:border-brand-gold">
            <NumInput
              value={received}
              onChange={(v) => {
                setReceived(v);
                setConfirmLoss(false);
              }}
              decimals={2}
              placeholder="0"
              ariaLabel={`المبلغ المستلم بالـ ${to}`}
              className="!border-0 !bg-transparent !p-0 !text-4xl !font-bold !text-white !shadow-none !ring-0 placeholder:!text-white/30"
            />
            </div>
            <span className="num text-lg font-semibold text-brand-gold">{to}</span>
          </div>
        </div>
      </div>

      {/* Where the deal sits against the website price */}
      <div className="card-sm space-y-3 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">
            السعر: <b className="num text-ink" dir="ltr">{rate ? `1 ${from} = ${fmtRate(gross / num(amount))} ${to}` : "—"}</b>
          </span>
          {both && (
            <span className={`num font-semibold ${Math.abs(diffPct) > 3 ? "text-amber-600" : "text-subtle"}`} dir="ltr">
              {diffPct > 0 ? "+" : ""}
              {diffPct.toFixed(1)}%
            </span>
          )}
        </div>
        <RateGauge diffPct={both ? diffPct : 0} />
      </div>

      {money && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface2 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] text-muted">
              <Lock size={11} /> سعر التكلفة
            </p>
            <p className="num mt-1 font-bold text-ink" dir="ltr">
              {cost ? fmtRate(cost) : "—"}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-subtle">
              {edit && cost === edit.cost
                ? "المحفوظ مع المعاملة"
                : `${from} ${data.costs[from] ? fmtRate(data.costs[from]!.avg) : "سوق"} · ${to} ${data.costs[to] ? fmtRate(data.costs[to]!.avg) : "سوق"}`}
            </p>
          </div>
          <div className={`rounded-2xl p-3.5 ${!both ? "bg-surface2" : isLoss ? "bg-red-500/10" : "bg-emerald-500/10"}`}>
            <p className="text-[11px] text-muted">الربح</p>
            <p className={`num mt-1 font-bold ${!both ? "text-subtle" : isLoss ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`} dir="ltr">
              {both ? fmtUsd(calc.profitUsd) : "—"}
            </p>
            {both && (
              <p className="num mt-0.5 text-[10px] text-subtle" dir="ltr">
                {fmtMoney(calc.gross + calc.spread, to)} − {fmtMoney(gross, to)} = {fmtMoney(calc.spread, to)}
              </p>
            )}
          </div>
        </div>
      )}

      {legacyFee && (
        <Field label="رسوم (معاملة قديمة)">
          <div className="space-y-2">
            <NumInput value={fee} onChange={setFee} decimals={2} placeholder="0" />
            {sideChips(feeSide, setFeeSide)}
          </div>
        </Field>
      )}

      {isLoss ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm font-semibold text-red-500">
          <p>خسارة: المستلم حياخد أكتر من قيمة فلوس العميل. راجع المبلغين.</p>
          <label className="mt-2.5 flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={confirmLoss} onChange={(e) => setConfirmLoss(e.target.checked)} className="size-4" />
            أؤكد إن المعاملة دي خسرانة
          </label>
        </div>
      ) : (
        both &&
        Math.abs(diffPct) > 3 && (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
            السعر بعيد عن سعر الموقع بـ <span className="num" dir="ltr">{Math.abs(diffPct).toFixed(1)}%</span> — راجع المبلغين.
          </p>
        )
      )}
    </div>
  );

  const stepDetails = (
    <div className="space-y-5">
      {/* the deal at a glance */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface2/60 p-3.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{customer?.name}</p>
          <p className="num text-xs text-muted" dir="ltr">
            {fmtMoney(num(amount), from)} {from} → {fmtMoney(num(received), to)} {to}
          </p>
        </div>
        {money && both && (
          <span className={`num shrink-0 font-bold ${isLoss ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`} dir="ltr">
            {fmtUsd(calc.profitUsd)}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted">الحالة</p>
        <Chips value={status} onChange={(v) => setStatus(v as TxStatus)} options={(Object.keys(STATUS_LABEL) as TxStatus[]).map((s) => ({ id: s, label: STATUS_LABEL[s] }))} />
      </div>

      {(accountsOf(from).length > 0 || accountsOf(to).length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {accountsOf(from).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted">استلمنا {from} في</p>
              <Chips value={validAccount(from, fromAccount)} onChange={setFromAccount} options={accountOptions(from)} />
            </div>
          )}
          {accountsOf(to).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted">دفعنا {to} من</p>
              <Chips value={validAccount(to, toAccount)} onChange={setToAccount} options={accountOptions(to)} />
            </div>
          )}
        </div>
      )}
      {short && (
        <p className="rounded-xl bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          المتاح من {to}
          {payoutAccount ? " في الصنف ده" : ""}: <span className="num" dir="ltr">{fmtMoney(available, to)}</span> — أقل من المبلغ اللي حيتسلّم.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs text-muted">العميل دفع بـ</p>
          <Chips value={payMethod} onChange={setPayMethod} options={methodOptions} />
        </div>
        <div className="space-y-2">
          <p className="text-xs text-muted">المستلم استلم بـ</p>
          <Chips value={payoutMethod} onChange={setPayoutMethod} options={methodOptions} />
        </div>
      </div>

      <Field label="المستلم (اسم / رقم حساب)">
        <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="field px-3 py-2.5 text-sm" />
      </Field>

      <button onClick={() => setMore((v) => !v)} className="text-xs font-semibold text-primary">
        {more ? "إخفاء الخيارات الإضافية" : "خيارات إضافية: التاريخ، المرجع، تكاليف، ملاحظات"}
      </button>
      {more && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="التاريخ">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
            </Field>
            <Field label="رقم المرجع">
              <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={autoRef} dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
            </Field>
          </div>
          <Field label="تكاليف علينا (شبكة / وكيل)" hint="تُخصم من الربح.">
            <div className="space-y-2">
              <NumInput value={expense} onChange={setExpense} decimals={2} placeholder="0" />
              {sideChips(expenseSide, setExpenseSide)}
            </div>
          </Field>
          <Field label="ملاحظات">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="field px-3 py-2.5 text-sm" />
          </Field>
        </div>
      )}
    </div>
  );

  const body = [stepCustomer, stepRoute, stepAmounts, stepDetails][step];

  /* ---------------------------------- frame ---------------------------------- */

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={edit ? `تعديل ${edit.ref}` : "معاملة جديدة"}>
      <div className="absolute inset-0 bg-[#06163a]/70" onClick={onClose} />
      <div className="relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-surface shadow-lift sm:max-w-xl sm:rounded-3xl">
        {/* header + progress rail */}
        <div className="border-b border-border/60 px-5 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-ink">{edit ? `تعديل ${edit.ref}` : "معاملة جديدة"}</h2>
            <button onClick={onClose} aria-label="إغلاق" className="rounded-full p-1.5 text-subtle hover:bg-surface2 hover:text-ink">
              <X size={18} />
            </button>
          </div>
          <ol className="mt-3 grid grid-cols-4 gap-1.5">
            {STEPS.map((s, i) => {
              const done = i < step || (i <= reached && i !== step);
              const open = i <= reached;
              return (
                <li key={s.label}>
                  <button
                    onClick={() => open && go(i as Step)}
                    disabled={!open}
                    aria-current={i === step ? "step" : undefined}
                    className="block w-full text-right disabled:cursor-default"
                  >
                    <span className={`block h-1.5 rounded-full transition-colors ${i === step ? "bg-brand-navy dark:bg-primary" : done ? "bg-brand-gold" : "bg-surface2"}`} />
                    <span className={`mt-1.5 block text-[11px] font-semibold ${i === step ? "text-ink" : open ? "text-muted" : "text-subtle"}`}>
                      {i + 1}. {s.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {/* what's been chosen so far */}
          {step > 0 && customer && (
            <p className="mt-2 truncate text-[11px] text-subtle">
              {customer.name}
              {step > 1 && (
                <>
                  {"  ·  "}
                  <span className="num" dir="ltr">
                    {from} → {to}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-5">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
            >
              {body}
            </motion.div>
          </AnimatePresence>
          {problem && <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-500">{problem}</p>}
        </div>

        {/* footer */}
        <div className="flex gap-2 border-t border-border/60 p-4">
          {step > 0 && (
            <button onClick={() => go((step - 1) as Step)} className="btn-ghost px-4 py-3.5 text-sm">
              <ChevronRight size={16} /> رجوع
            </button>
          )}
          {step < 3 ? (
            <button onClick={() => go((step + 1) as Step)} disabled={!canNext[step]} className="btn-primary flex-1 py-3.5 text-sm">
              التالي <ChevronLeft size={16} />
            </button>
          ) : (
            <button onClick={save} disabled={saving || (isLoss && !confirmLoss)} className="btn-gold flex-1 py-3.5 text-sm">
              <Check size={16} /> {saving ? "جارٍ الحفظ…" : edit ? "حفظ التعديلات" : "حفظ المعاملة"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
