"use client";

import { useMemo, useState } from "react";
import { Check, Download, Plus, Trash2 } from "lucide-react";
import { CURRENCIES, CURRENCY_LIST, type CurrencyCode } from "@/lib/currencies";
import { fmtMoney, fmtUsd, todayStr } from "@/lib/format";
import { downloadCsv } from "@/lib/data";
import { accountLabel, accountsOf, EXPENSE_CATEGORIES, netResult, validAccount } from "@/lib/books";
import { totals, PERIODS, periodRange, inRange, type PeriodKey } from "@/lib/stats";
import { newId } from "@/lib/store";
import type { AdminData } from "./AdminApp";
import { Empty, Field, Modal, NumInput, Panel, RankBars } from "./ui";

function ExpenseForm({ data, onClose }: { data: AdminData; onClose: () => void }) {
  const [cur, setCur] = useState<CurrencyCode>("USD");
  const [account, setAccount] = useState(accountsOf("USD")[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const a = parseFloat(amount) || 0;
  const usd = data.costUsd[cur] ? a / data.costUsd[cur] : 0;
  const bal = data.balances.find((b) => b.currency === cur);
  const available = accountsOf(cur).length ? bal?.accounts.find((x) => x.id === account)?.balance ?? 0 : bal?.balance ?? 0;

  return (
    <Modal title="مصروف جديد" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs text-muted">البند</p>
          <div className="flex flex-wrap gap-1.5">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${category === c ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اتدفع بـ">
            <select
              value={cur}
              onChange={(e) => {
                const next = e.target.value as CurrencyCode;
                setCur(next);
                setAccount(accountsOf(next)[0]?.id ?? "");
              }}
              className="field px-3 py-2.5 text-sm font-semibold"
            >
              {CURRENCY_LIST.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المبلغ" hint={usd ? `≈ ${fmtUsd(usd)} بتكلفتك` : undefined}>
            <NumInput value={amount} onChange={setAmount} suffix={cur} decimals={2} placeholder="0" className="text-base" />
          </Field>
        </div>

        {accountsOf(cur).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted">طلع من</p>
            <div className="flex flex-wrap gap-1.5">
              {accountsOf(cur).map((x) => (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => setAccount(x.id)}
                  aria-pressed={account === x.id}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${account === x.id ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"}`}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </div>
        )}
        {a > available && (
          <p className="text-xs font-semibold text-amber-600">
            المتاح هنا <span className="num" dir="ltr">{fmtMoney(available, cur)} {cur}</span> — الرصيد حيبقى بالسالب.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="التاريخ">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
          </Field>
          <Field label="ملاحظة">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="إيجار شهر أكتوبر" className="field px-3 py-2.5 text-sm" />
          </Field>
        </div>

        <button
          disabled={!a || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await data.upsertMovement({
                id: newId(),
                date,
                currency: cur,
                kind: "expense",
                amount: a,
                category,
                note: note.trim(),
                account: validAccount(cur, account),
                createdAt: new Date().toISOString(),
              });
              onClose();
            } catch {
              setSaving(false);
            }
          }}
          className="btn-primary w-full py-3.5 text-sm"
        >
          <Check size={16} /> {saving ? "جارٍ الحفظ…" : "حفظ المصروف"}
        </button>
      </div>
    </Modal>
  );
}

export default function ExpensesTab({ data }: { data: AdminData }) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const money = data.can("finance");
  const range = periodRange(period);
  const inPeriod = (d: string) => d >= range.from && d <= range.to;

  const list = useMemo(() => data.expenses.filter((e) => inPeriod(e.date)), [data.expenses, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = list.reduce((s, e) => s + e.usd, 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of list) m.set(e.category, (m.get(e.category) ?? 0) + e.usd);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [list]);

  const deal = totals(data.txs.filter((t) => inRange(t, range))).profit;
  const fx = data.exchange.filter((e) => inPeriod(e.date)).reduce((s, e) => s + e.gainUsd, 0);
  const r = netResult(deal, fx, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="الفترة">
          {PERIODS.filter(([k]) => k !== "custom").map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              aria-pressed={period === k}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${period === k ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setAdding(true)} className="btn-primary mr-auto px-4 py-2.5 text-xs">
          <Plus size={14} /> مصروف جديد
        </button>
      </div>

      {/* expenses come out of profit first, the rest out of capital */}
      <div className="card-sm p-4">
        <p className="text-xs text-muted">مصروفات الفترة</p>
        <p className="num mt-1 text-3xl font-bold text-ink" dir="ltr">
          {fmtUsd(total)}
        </p>
        {money && total > 0 && (
          <>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface2">
              <div className="h-full bg-emerald-500" style={{ width: `${(r.fromProfit / total) * 100}%` }} />
              <div className="h-full bg-red-500" style={{ width: `${(r.fromCapital / total) * 100}%` }} />
            </div>
            <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400">
                من الربح: <b className="num" dir="ltr">{fmtUsd(r.fromProfit)}</b>
              </span>
              {r.fromCapital > 0 && (
                <span className="text-red-500">
                  من رأس المال: <b className="num" dir="ltr">{fmtUsd(r.fromCapital)}</b>
                </span>
              )}
            </div>
            <p className="mt-3 border-t border-border/60 pt-3 text-sm text-muted">
              صافي الربح بعد المصروفات:{" "}
              <b className={`num ${r.net < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`} dir="ltr">
                {fmtUsd(r.net)}
              </b>
            </p>
          </>
        )}
      </div>

      {byCategory.length > 0 && (
        <Panel title="حسب البند">
          <RankBars rows={byCategory.map(([k, v]) => ({ key: k, label: k, value: v, display: fmtUsd(v) }))} />
        </Panel>
      )}

      <Panel
        title="السجل"
        action={
          list.length > 0 ? (
            <button
              onClick={() =>
                downloadCsv(`master-digital-expenses-${todayStr()}.csv`, [
                  ["التاريخ", "البند", "المبلغ", "العملة", "الحساب", "القيمة (USD)", "ملاحظة", "بواسطة"],
                  ...list.map((e) => [e.date, e.category, e.amount, e.currency, accountLabel(e.currency, e.account), Math.round(e.usd * 100) / 100, e.note, e.by ?? ""]),
                ])
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
            >
              <Download size={13} /> تصدير
            </button>
          ) : undefined
        }
      >
        {list.length === 0 ? (
          <Empty title="ما في مصروفات في الفترة دي" hint="سجّل الإيجار، الرواتب وأي تكلفة تشغيل — بتتخصم من الربح والسيولة تلقائياً." />
        ) : (
          <ul className="divide-y divide-border/50">
            {list.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {e.category}
                    {e.note && <span className="font-normal text-muted"> — {e.note}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-subtle">
                    <span className="num" dir="ltr">{e.date}</span>
                    {e.account && <> · {accountLabel(e.currency, e.account)}</>}
                    {e.by && <> · {e.by}</>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="text-left">
                    <p className="num text-sm font-bold text-red-500" dir="ltr">
                      −{fmtMoney(e.amount, e.currency)} <span className="text-[10px] text-subtle">{CURRENCIES[e.currency]?.code ?? e.currency}</span>
                    </p>
                    {e.currency !== "USD" && e.currency !== "USDT" && (
                      <p className="num text-[10px] text-subtle" dir="ltr">
                        ≈ {fmtUsd(e.usd)}
                      </p>
                    )}
                  </div>
                  {confirmId === e.id ? (
                    <button onClick={() => data.removeMovement(e.id)} className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white">
                      تأكيد
                    </button>
                  ) : (
                    <button onClick={() => setConfirmId(e.id)} aria-label="حذف المصروف" className="rounded-lg p-1 text-subtle hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {adding && <ExpenseForm data={data} onClose={() => setAdding(false)} />}
    </div>
  );
}
