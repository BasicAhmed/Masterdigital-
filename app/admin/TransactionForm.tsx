"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, Search, UserPlus, X } from "lucide-react";
import { CURRENCIES, CURRENCY_LIST, destinationsFor, findPair, routeKey, type CurrencyCode } from "@/lib/currencies";
import { computeTx, type FeeSide } from "@/lib/calc";
import { fmt, fmtMoney, fmtPct, fmtRate, fmtUsd, todayStr } from "@/lib/format";
import { blankCustomer, nextRef, PAYMENT_METHODS, STATUS_LABEL, type Customer, type Transaction, type TxStatus } from "@/lib/data";
import { newId } from "@/lib/store";
import type { AdminData } from "./AdminApp";
import { Field, Modal, NumInput } from "./ui";

const num = (s: string) => parseFloat(s) || 0;

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
  const [customerId, setCustomerId] = useState<string | null>(edit?.customerId ?? initialCustomerId ?? null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Customer>(blankCustomer());

  const [date, setDate] = useState(edit?.date ?? todayStr());
  const [ref, setRef] = useState(edit?.ref ?? "");
  const [from, setFrom] = useState<CurrencyCode>(edit?.from ?? "SDG");
  const [to, setTo] = useState<CurrencyCode>(edit?.to ?? "UGX");
  const routeOf = (f: CurrencyCode, t: CurrencyCode) => routes.find((r) => r.id === routeKey(f, t));
  const [amount, setAmount] = useState(edit ? String(edit.amount) : "");
  const [rate, setRate] = useState(String(edit?.rate ?? routeOf("SDG", "UGX")?.rate ?? ""));
  const [cost, setCost] = useState(String(edit?.cost ?? routeOf("SDG", "UGX")?.cost ?? ""));
  const [fee, setFee] = useState(edit?.fee ? String(edit.fee) : "");
  const [feeSide, setFeeSide] = useState<FeeSide>(edit?.feeSide ?? "to");
  const [expense, setExpense] = useState(edit?.expense ? String(edit.expense) : "");
  const [expenseSide, setExpenseSide] = useState<FeeSide>(edit?.expenseSide ?? "to");
  const [payMethod, setPayMethod] = useState(edit?.payMethod ?? "");
  const [payoutMethod, setPayoutMethod] = useState(edit?.payoutMethod ?? "");
  const [recipient, setRecipient] = useState(edit?.recipient ?? "");
  const [status, setStatus] = useState<TxStatus>(edit?.status ?? "completed");
  const [notes, setNotes] = useState(edit?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const customer = customers.find((c) => c.id === customerId) ?? null;
  const pair = findPair(from, to)!;
  const route = routeOf(from, to);
  const usd = data.usd;
  const autoRef = useMemo(() => nextRef(date, txs), [date, txs]);

  const calc = computeTx({
    from,
    to,
    amount: num(amount),
    rate: num(rate),
    cost: num(cost),
    fee: num(fee),
    feeSide,
    expense: num(expense),
    expenseSide,
    usd,
  });

  // Cash on hand in the payout currency. When editing a completed transfer, its own payout is added back first.
  const available =
    (data.balances.find((b) => b.currency === to)?.balance ?? 0) +
    (edit && edit.status === "completed" && edit.to === to ? edit.payout : 0);

  function pickRoute(f: CurrencyCode, t: CurrencyCode) {
    setFrom(f);
    setTo(t);
    const r = routeOf(f, t);
    setRate(r ? String(r.rate) : "");
    setCost(r ? String(r.cost) : "");
  }

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")))
      : customers;
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "ar")).slice(0, 30);
  }, [customers, query]);

  async function createCustomer() {
    if (!draft.name.trim()) return;
    const c = await data.upsertCustomer({ ...draft, name: draft.name.trim(), phone: draft.phone.trim() });
    setCustomerId(c.id);
    setCreating(false);
    setDraft(blankCustomer());
    setQuery("");
  }

  async function save() {
    setProblem(null);
    if (!customer) return setProblem("اختار العميل أولاً.");
    if (!num(amount)) return setProblem("اكتب مبلغ التحويل.");
    if (!num(rate) || !num(cost)) return setProblem("سعر العميل وسعر التكلفة مطلوبين.");
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
        rate: num(rate),
        cost: num(cost),
        fee: num(fee),
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
        status,
        notes: notes.trim(),
        createdAt: edit?.createdAt ?? new Date().toISOString(),
      });
      onClose();
    } catch {
      setSaving(false);
    }
  }

  const sideSelect = (value: FeeSide, onChange: (v: FeeSide) => void, label: string) => (
    <div className="w-24 shrink-0">
      <select value={value} onChange={(e) => onChange(e.target.value as FeeSide)} aria-label={label} className="field px-2 py-2.5 font-mono text-xs font-semibold" dir="ltr">
        <option value="to">{to}</option>
        <option value="from">{from}</option>
      </select>
    </div>
  );
  const methodSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="field px-3 py-2.5 text-sm">
      <option value="">—</option>
      {PAYMENT_METHODS.map((m) => (
        <option key={m}>{m}</option>
      ))}
    </select>
  );

  return (
    <Modal title={edit ? `تعديل المعاملة ${edit.ref}` : "معاملة جديدة"} onClose={onClose} wide>
      <div className="space-y-6">
        {/* 1 — Customer */}
        <section>
          <p className="mb-2 text-xs font-bold text-primary">1 · العميل</p>
          {customer ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{customer.name}</p>
                <p className="num text-xs text-muted" dir="ltr">
                  {customer.phone || "—"}
                </p>
              </div>
              <button onClick={() => setCustomerId(null)} className="btn-ghost px-3 py-1.5 text-xs">
                <X size={13} /> تغيير
              </button>
            </div>
          ) : creating ? (
            <div className="space-y-3 rounded-2xl border border-border/70 bg-surface2/50 p-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="اسم العميل *">
                  <input autoFocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="field px-3 py-2.5 text-sm" />
                </Field>
                <Field label="رقم الهاتف">
                  <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} dir="ltr" inputMode="tel" className="field px-3 py-2.5 font-mono text-sm" />
                </Field>
                <Field label="الدولة">
                  <input value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} className="field px-3 py-2.5 text-sm" />
                </Field>
              </div>
              <div className="flex gap-2">
                <button onClick={createCustomer} disabled={!draft.name.trim()} className="btn-primary px-4 py-2 text-xs">
                  <Check size={14} /> حفظ العميل واختياره
                </button>
                <button onClick={() => setCreating(false)} className="btn-ghost px-4 py-2 text-xs">
                  رجوع للقائمة
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ابحث بالاسم أو رقم الهاتف…"
                    className="field py-2.5 pl-3 pr-9 text-sm"
                  />
                </div>
                <button
                  onClick={() => {
                    setDraft({ ...blankCustomer(), name: /\d{5,}/.test(query) ? "" : query.trim(), phone: /\d{5,}/.test(query) ? query.trim() : "" });
                    setCreating(true);
                  }}
                  className="btn-ghost shrink-0 px-3.5 py-2 text-xs"
                >
                  <UserPlus size={14} /> عميل جديد
                </button>
              </div>
              <ul className="mt-2 max-h-44 divide-y divide-border/50 overflow-y-auto rounded-2xl border border-border/70">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setCustomerId(c.id)} className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-right transition-colors hover:bg-primary/5">
                      <span className="truncate text-sm font-medium text-ink">{c.name}</span>
                      <span className="num shrink-0 text-xs text-subtle" dir="ltr">
                        {c.phone}
                      </span>
                    </button>
                  </li>
                ))}
                {matches.length === 0 && (
                  <li className="px-3.5 py-4 text-center text-xs text-subtle">
                    {customers.length ? "ما في عميل بالاسم ده — اضغط «عميل جديد»." : "لسه ما في عملاء — اضغط «عميل جديد»."}
                  </li>
                )}
              </ul>
            </div>
          )}
        </section>

        {/* 2 — Route & amounts */}
        <section>
          <p className="mb-2 text-xs font-bold text-primary">2 · المسار والمبلغ</p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Field label="من عملة">
              <select value={from} onChange={(e) => { const f = e.target.value as CurrencyCode; pickRoute(f, destinationsFor(f).includes(to) ? to : destinationsFor(f)[0]); }} className="field px-3 py-2.5 text-sm font-semibold">
                {CURRENCY_LIST.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <button onClick={() => pickRoute(to, from)} aria-label="عكس المسار" title="عكس المسار" className="mb-0.5 flex size-10 items-center justify-center rounded-full border border-border bg-surface text-primary shadow-soft hover:border-primary/60">
              <ArrowLeftRight size={15} />
            </button>
            <Field label="إلى عملة">
              <select value={to} onChange={(e) => pickRoute(from, e.target.value as CurrencyCode)} className="field px-3 py-2.5 text-sm font-semibold">
                {destinationsFor(from).map((c) => (
                  <option key={c} value={c}>
                    {CURRENCIES[c].flag} {c} — {CURRENCIES[c].name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {route && !route.active && <p className="mt-2 text-[11px] font-semibold text-amber-600">تنبيه: المسار ده مقفول في صفحة الأسعار.</p>}

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label={`المبلغ المستلم من العميل`}>
              <NumInput value={amount} onChange={setAmount} suffix={from} decimals={2} placeholder="0" className="text-base" />
            </Field>
            <Field label={`سعر العميل (لكل ${fmt(pair.unit)} ${pair.base})`} hint={route ? `سعر المسار الحالي: ${fmtRate(route.rate)}` : undefined}>
              <NumInput value={rate} onChange={setRate} suffix={pair.quote} />
            </Field>
            <Field label="سعر التكلفة" hint={route ? `تكلفة المسار الحالية: ${fmtRate(route.cost)}` : undefined}>
              <NumInput value={cost} onChange={setCost} suffix={pair.quote} />
            </Field>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="رسوم على العميل" hint="بعملة الاستلام = تُخصم من المبلغ المستلم.">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <NumInput value={fee} onChange={setFee} decimals={2} placeholder="0" />
                </div>
                {sideSelect(feeSide, setFeeSide, "عملة الرسوم")}
              </div>
            </Field>
            <Field label="تكاليف علينا (شبكة / وكيل)" hint="تُخصم من الربح.">
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <NumInput value={expense} onChange={setExpense} decimals={2} placeholder="0" />
                </div>
                {sideSelect(expenseSide, setExpenseSide, "عملة التكاليف")}
              </div>
            </Field>
          </div>
        </section>

        {/* Live calculation */}
        <section className="overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 via-transparent to-accent/10">
          <div className="grid grid-cols-2 gap-px bg-border/50 sm:grid-cols-4">
            {(
              [
                ["العميل يدفع", `${fmtMoney(calc.customerPays, from)} ${from}`],
                ["المستلم يستلم", `${fmtMoney(calc.payout, to)} ${to}`],
                ["الإيراد", fmtUsd(calc.revenueUsd)],
                ["صافي الربح", fmtUsd(calc.profitUsd)],
              ] as const
            ).map(([label, value], i) => (
              <div key={label} className="bg-surface p-3.5">
                <p className="text-[11px] text-muted">{label}</p>
                <p className={`num mt-1 text-base font-bold sm:text-lg ${i === 3 ? (calc.profitUsd < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400") : "text-ink"}`} dir="ltr">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <p className="flex flex-wrap gap-x-5 gap-y-1 px-3.5 py-2.5 text-[11px] text-muted">
            <span>
              هامش المسار: <b className="num text-ink" dir="ltr">{fmtPct(calc.marginPercent)}</b>
            </span>
            <span>
              ربح فرق السعر: <b className="num text-ink" dir="ltr">{fmtMoney(calc.spread, to)} {to}</b>
            </span>
            <span>
              حجم المعاملة: <b className="num text-ink" dir="ltr">{fmtUsd(calc.volumeUsd)}</b>
            </span>
            <span>
              المتاح من {to}: <b className="num text-ink" dir="ltr">{fmtMoney(available, to)}</b>
            </span>
            <span>
              هامش الربح من الحجم: <b className="num text-ink" dir="ltr">{fmtPct(calc.profitMarginPercent)}</b>
            </span>
          </p>
          {num(amount) > 0 && status === "completed" && calc.payout > available + 1e-9 && (
            <p className="border-t border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              السيولة المتاحة من {to} ({fmtMoney(available, to)}) أقل من المبلغ اللي حيتسلّم — راجع صفحة السيولة.
            </p>
          )}
          {num(amount) > 0 && calc.marginPercent < 0 && (
            <p className="border-t border-red-500/20 bg-red-500/10 px-3.5 py-2 text-[11px] font-semibold text-red-500">
              سعر العميل أحسن من سعر التكلفة — المعاملة دي خسرانة في فرق السعر.
            </p>
          )}
        </section>

        {/* 3 — Details */}
        <section>
          <p className="mb-2 text-xs font-bold text-primary">3 · تفاصيل المعاملة</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="التاريخ">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
            </Field>
            <Field label="رقم المرجع" hint="اتركه فاضي للترقيم التلقائي.">
              <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={autoRef} dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
            </Field>
            <Field label="الحالة">
              <select value={status} onChange={(e) => setStatus(e.target.value as TxStatus)} className="field px-3 py-2.5 text-sm font-semibold">
                {(Object.keys(STATUS_LABEL) as TxStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="طريقة دفع العميل">{methodSelect(payMethod, setPayMethod)}</Field>
            <Field label="طريقة التسليم">{methodSelect(payoutMethod, setPayoutMethod)}</Field>
            <Field label="المستلم (اسم / رقم حساب)">
              <input value={recipient} onChange={(e) => setRecipient(e.target.value)} className="field px-3 py-2.5 text-sm" />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="ملاحظات">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="field px-3 py-2.5 text-sm" />
            </Field>
          </div>
        </section>

        {problem && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-500">{problem}</p>}

        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 py-3.5 text-sm">
            <Check size={16} /> {saving ? "جارٍ الحفظ…" : edit ? "حفظ التعديلات" : "حفظ المعاملة"}
          </button>
          <button onClick={onClose} className="btn-ghost px-6 py-3.5 text-sm">
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
