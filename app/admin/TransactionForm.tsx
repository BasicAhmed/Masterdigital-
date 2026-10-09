"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, Search, UserPlus, X } from "lucide-react";
import { CURRENCIES, CURRENCY_LIST, destinationsFor, findPair, routeKey, type CurrencyCode } from "@/lib/currencies";
import { findPair as findCorridor } from "@/lib/corridors";
import { computeTx, perUnit, rateFromAmounts, type FeeSide } from "@/lib/calc";
import { fmtMoney, fmtPct, fmtRate, fmtUsd, todayStr } from "@/lib/format";
import { blankCustomer, nextCustomerCode, nextRef, PAYMENT_METHODS, STATUS_LABEL, type Customer, type Transaction, type TxStatus } from "@/lib/data";
import { newId } from "@/lib/store";
import { accountsOf, validAccount } from "@/lib/books";
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
  /** Cost of a route from what his money really cost him (his liquidity
   *  average per currency, or the market where he has none). Same quoting
   *  as the route's market price: units of the pair's first currency per 1
   *  of the second. The customer rate still comes from the website. */
  const costOf = (f: CurrencyCode, t: CurrencyCode): number | undefined => {
    const p = findCorridor(f, t);
    const x = p && data.costUsd[p.a];
    const y = p && data.costUsd[p.b];
    return x && y ? +(x / y).toPrecision(6) : routeOf(f, t)?.cost;
  };
  // Staff type BOTH amounts — what the customer hands over and what the
  // recipient gets. The rate is worked out from them.
  const [amount, setAmount] = useState(edit ? String(edit.amount) : "");
  const [received, setReceived] = useState(edit ? String(edit.payout) : "");
  const [confirmLoss, setConfirmLoss] = useState(false);
  const [cost, setCost] = useState(String(edit?.cost ?? costOf("SDG", "UGX") ?? ""));
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
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  // Staff without the finance permission don't see cost, revenue or profit.
  const money = data.can("finance");
  const customer = customers.find((c) => c.id === customerId) ?? null;
  const pair = findPair(from, to)!;
  const route = routeOf(from, to);
  // profit is turned into dollars with his own rates (his formula: ÷ rate of the received currency)
  const usd = data.costUsd;
  const fromCost = data.costs[from]?.avg;
  const toCost = data.costs[to]?.avg;
  const autoRef = useMemo(() => nextRef(date, txs), [date, txs]);

  // Fees only exist on deals saved before amounts were typed directly —
  // the agreed amounts already include any fee.
  const legacyFee = !!edit?.fee;
  const feeNow = legacyFee ? num(fee) : 0;
  const gross = num(received) + (legacyFee && feeSide === "to" ? feeNow : 0);
  const rate = rateFromAmounts(from, to, num(amount), gross);
  const sitePer = route ? perUnit(from, to, route.rate) : 0; // units of `to` per 1 `from` on the website
  const diffPct = sitePer && num(amount) && gross ? ((gross / num(amount) - sitePer) / sitePer) * 100 : 0;
  const decimalsTo = CURRENCIES[to]?.decimals ?? 2;
  function useSitePrice() {
    if (!sitePer || !num(amount)) return;
    const f = Math.pow(10, decimalsTo);
    setReceived(String(Math.floor(num(amount) * sitePer * f) / f));
    setConfirmLoss(false);
  }

  const calc = computeTx({
    from,
    to,
    amount: num(amount),
    rate,
    cost: num(cost),
    fee: feeNow,
    feeSide,
    expense: num(expense),
    expenseSide,
    usd,
  });
  const isLoss = num(amount) > 0 && num(received) > 0 && calc.profitUsd < -1e-9;

  // Cash on hand in the payout currency. When editing a completed transfer, its own payout is added back first.
  // With a payout category chosen, the check uses that category's balance.
  const toBalance = data.balances.find((b) => b.currency === to);
  const payoutAccount = validAccount(to, toAccount);
  const wasHere = !!edit && edit.status === "completed" && edit.to === to && validAccount(to, edit.toAccount) === payoutAccount;
  const available =
    (payoutAccount ? toBalance?.accounts.find((a) => a.id === payoutAccount)?.balance ?? 0 : toBalance?.balance ?? 0) +
    (wasHere ? edit!.payout : 0);

  function pickRoute(f: CurrencyCode, t: CurrencyCode) {
    setFrom(f);
    setTo(t);
    setFromAccount((a: string) => validAccount(f, a));
    setToAccount((a: string) => validAccount(t, a));
    if (t !== to) setReceived(""); // an amount in the old currency means nothing now
    setConfirmLoss(false);
    const c = costOf(f, t);
    setCost(c ? String(c) : "");
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
    if (!num(amount)) return setProblem("اكتب المبلغ المرسل.");
    if (!num(received)) return setProblem("اكتب المبلغ المستلم.");
    if (!rate || !num(cost)) return setProblem("سعر التكلفة مطلوب.");
    if (isLoss && !confirmLoss) return setProblem("المعاملة خسرانة — راجع المبلغين أو أكّد الخسارة.");
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
        cost: num(cost),
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
                    setDraft({ ...blankCustomer(nextCustomerCode(customers)), name: /\d{5,}/.test(query) ? "" : query.trim(), phone: /\d{5,}/.test(query) ? query.trim() : "" });
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
            <Field label={`المبلغ المرسل (${from})`} hint="اللي دفعه العميل">
              <NumInput
                value={amount}
                onChange={(v) => {
                  setAmount(v);
                  setConfirmLoss(false);
                }}
                suffix={from}
                decimals={2}
                placeholder="0"
                className="text-base"
              />
            </Field>
            <Field label={`المبلغ المستلم (${to})`} hint="اللي حيستلمه المستلم">
              <NumInput
                value={received}
                onChange={(v) => {
                  setReceived(v);
                  setConfirmLoss(false);
                }}
                suffix={to}
                decimals={2}
                placeholder="0"
                className="text-base"
              />
              {sitePer > 0 && num(amount) > 0 && (
                <button type="button" onClick={useSitePrice} className="mt-1.5 text-[11px] font-semibold text-primary">
                  استخدم سعر الموقع ({fmtMoney(num(amount) * sitePer, to)} {to})
                </button>
              )}
            </Field>
            {money && (
              <Field
                label="سعر التكلفة (من السيولة)"
                hint={`${from} ${fromCost ? fmtRate(fromCost) : "سعر السوق"} · ${to} ${toCost ? fmtRate(toCost) : "سعر السوق"}${from === "USDT" || to === "USDT" ? " · USDT = 1" : ""}`}
              >
                <NumInput value={cost} onChange={setCost} suffix={pair.quote} />
              </Field>
            )}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {legacyFee && (
              <Field label="رسوم (معاملة قديمة)" hint="المعاملات الجديدة: المبلغين بيشملوا الرسوم.">
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <NumInput value={fee} onChange={setFee} decimals={2} placeholder="0" />
                  </div>
                  {sideSelect(feeSide, setFeeSide, "عملة الرسوم")}
                </div>
              </Field>
            )}
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
          <div className={`grid grid-cols-2 gap-px bg-border/50 ${money ? "sm:grid-cols-4" : ""}`}>
            {(
              [
                ["السعر (محسوب)", rate ? fmtRate(rate) : "—"],
                ["سعر الموقع", route ? fmtRate(route.rate) : "—"],
                ["الإيراد", fmtUsd(calc.revenueUsd)],
                ["صافي الربح", fmtUsd(calc.profitUsd)],
              ] as const
            ).slice(0, money ? 4 : 2).map(([label, value], i) => (
              <div key={label} className="bg-surface p-3.5">
                <p className="text-[11px] text-muted">{label}</p>
                <p className={`num mt-1 text-base font-bold sm:text-lg ${i === 3 ? (calc.profitUsd < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400") : "text-ink"}`} dir="ltr">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <p className="flex flex-wrap gap-x-5 gap-y-1 px-3.5 py-2.5 text-[11px] text-muted">
            {money && (
              <span>
                هامش المسار: <b className="num text-ink" dir="ltr">{fmtPct(calc.marginPercent)}</b>
              </span>
            )}
            {money && num(amount) > 0 && num(received) > 0 && (
              <span>
                الربح: <b className="num text-ink" dir="ltr">{fmtMoney(calc.gross + calc.spread, to)} − {fmtMoney(gross, to)} = {fmtMoney(calc.spread, to)} {to}</b>
              </span>
            )}
            <span>
              حجم المعاملة: <b className="num text-ink" dir="ltr">{fmtUsd(calc.volumeUsd)}</b>
            </span>
            <span>
              المتاح من {to}: <b className="num text-ink" dir="ltr">{fmtMoney(available, to)}</b>
            </span>
            {money && (
              <span>
                هامش الربح من الحجم: <b className="num text-ink" dir="ltr">{fmtPct(calc.profitMarginPercent)}</b>
              </span>
            )}
          </p>
          {num(amount) > 0 && status === "completed" && calc.payout > available + 1e-9 && (
            <p className="border-t border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
              السيولة المتاحة من {to} ({fmtMoney(available, to)}) أقل من المبلغ اللي حيتسلّم — راجع صفحة السيولة.
            </p>
          )}
          {isLoss ? (
            <div className="border-t border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[12px] font-semibold text-red-500">
              <p>
                خسارة: المستلم حياخد أكتر من قيمة فلوس العميل
                {money && (
                  <>
                    {" "}(<span className="num" dir="ltr">{fmtUsd(calc.profitUsd)}</span>)
                  </>
                )}
                . راجع المبلغين.
              </p>
              <label className="mt-2 flex items-center gap-2 font-medium">
                <input type="checkbox" checked={confirmLoss} onChange={(e) => setConfirmLoss(e.target.checked)} className="size-4" />
                أؤكد إن المعاملة دي خسرانة
              </label>
            </div>
          ) : (
            Math.abs(diffPct) > 3 && (
              <p className="border-t border-amber-500/20 bg-amber-500/10 px-3.5 py-2 text-[12px] font-semibold text-amber-700 dark:text-amber-400">
                السعر بعيد عن سعر الموقع بـ <span className="num" dir="ltr">{Math.abs(diffPct).toFixed(1)}%</span> — راجع المبلغين.
              </p>
            )
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
            {accountsOf(from).length > 0 && (
              <Field label={`استلمنا ${from} في`} hint="الصنف اللي دخلت فيه فلوس العميل.">
                <select value={validAccount(from, fromAccount)} onChange={(e) => setFromAccount(e.target.value)} className="field px-3 py-2.5 text-sm">
                  <option value="">غير مصنّف</option>
                  {accountsOf(from).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {accountsOf(to).length > 0 && (
              <Field label={`دفعنا ${to} من`} hint="الصنف اللي طلعت منه فلوس المستلم.">
                <select value={validAccount(to, toAccount)} onChange={(e) => setToAccount(e.target.value)} className="field px-3 py-2.5 text-sm">
                  <option value="">غير مصنّف</option>
                  {accountsOf(to).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <div className="mt-3">
            <Field label="ملاحظات">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="field px-3 py-2.5 text-sm" />
            </Field>
          </div>
        </section>

        {problem && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-500">{problem}</p>}

        <div className="flex gap-2">
          <button onClick={save} disabled={saving || (isLoss && !confirmLoss)} className="btn-primary flex-1 py-3.5 text-sm">
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
