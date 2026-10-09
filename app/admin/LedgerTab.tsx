"use client";

import { useMemo, useState } from "react";
import { Building2, Check, Download, HandCoins, Pencil, Plus, Search, Trash2, User } from "lucide-react";
import { CURRENCIES, CURRENCY_LIST, type CurrencyCode } from "@/lib/currencies";
import { toUsd } from "@/lib/calc";
import { fmtMoney, fmtUsd, todayStr } from "@/lib/format";
import { downloadCsv } from "@/lib/data";
import {
  KIND_LABEL,
  blankObligation,
  isOverdue,
  isSettled,
  paidOf,
  partyBalances,
  positions,
  remainingOf,
  type Obligation,
  type ObligationKind,
  type PartyType,
} from "@/lib/books";
import { newId } from "@/lib/store";
import type { AdminData } from "./AdminApp";
import { Empty, Field, Modal, NumInput, Panel, Stat } from "./ui";

const num = (s: string) => parseFloat(s) || 0;

function KindChip({ kind }: { kind: ObligationKind }) {
  return (
    <span className={`chip ${kind === "receivable" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}>
      {KIND_LABEL[kind]}
    </span>
  );
}

export function ObligationForm({ initial, data, onClose }: { initial: Obligation; data: AdminData; onClose: () => void }) {
  const isNew = !data.obligations.some((o) => o.id === initial.id);
  const [o, setO] = useState<Obligation>({ ...initial, date: initial.date || todayStr() });
  const [amount, setAmount] = useState(initial.amount ? String(initial.amount) : "");
  const [saving, setSaving] = useState(false);
  const paid = paidOf(o);
  const tooLow = num(amount) < paid - 1e-9;
  const valid = o.party.trim() && num(amount) > 0 && o.date && !tooLow;

  return (
    <Modal title={isNew ? "تسجيل مبلغ مستحق" : "تعديل المستحق"} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface2 p-1" role="group" aria-label="نوع المستحق">
          {(["receivable", "payable"] as ObligationKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setO({ ...o, kind: k })}
              aria-pressed={o.kind === k}
              className={`rounded-lg py-2.5 text-sm font-semibold ${o.kind === k ? "bg-brand-navy text-white" : "text-muted"}`}
            >
              {k === "receivable" ? "لنا — طرف مديون لينا" : "علينا — نحن مديونين لطرف"}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <Field label="النوع">
            <select value={o.partyType} onChange={(e) => setO({ ...o, partyType: e.target.value as PartyType })} className="field px-3 py-2.5 text-sm">
              <option value="person">فرد</option>
              <option value="company">شركة</option>
            </select>
          </Field>
          <Field label="الطرف *" hint="اختار من العملاء أو اكتب اسم جديد.">
            <input
              value={o.party}
              onChange={(e) => {
                const name = e.target.value;
                const match = data.customers.find((c) => c.name === name);
                setO({ ...o, party: name, customerId: match?.id ?? "" });
              }}
              list="party-list"
              className="field px-3 py-2.5 text-sm"
            />
            <datalist id="party-list">
              {data.customers.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="العملة">
            <select value={o.currency} onChange={(e) => setO({ ...o, currency: e.target.value as CurrencyCode })} className="field px-3 py-2.5 text-sm font-semibold">
              {CURRENCY_LIST.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="المبلغ *">
            <NumInput value={amount} onChange={setAmount} suffix={o.currency} decimals={2} placeholder="0" className="text-base" />
          </Field>
          <Field label="التاريخ">
            <input type="date" value={o.date} onChange={(e) => setO({ ...o, date: e.target.value })} dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
          </Field>
          <Field label="تاريخ الاستحقاق (اختياري)">
            <input type="date" value={o.dueDate} onChange={(e) => setO({ ...o, dueDate: e.target.value })} dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
          </Field>
        </div>
        {tooLow && <p className="text-xs font-semibold text-red-500">المبلغ أقل من المسدد بالفعل ({fmtMoney(paid, o.currency)}).</p>}

        <label className="flex items-start gap-3 rounded-xl border border-border bg-surface2/60 p-3 text-sm text-ink">
          <input type="checkbox" checked={o.cashMoved} onChange={(e) => setO({ ...o, cashMoved: e.target.checked })} className="mt-1 size-4 accent-[#072969]" />
          <span>
            {o.kind === "receivable" ? "المبلغ ده طلع من سيولتنا (سلفة)" : "المبلغ ده دخل سيولتنا (استلمناه)"}
            <span className="mt-0.5 block text-xs text-muted">
              لو فعّلته، رصيد {o.currency} في صفحة السيولة {o.kind === "receivable" ? "ينقص" : "يزيد"} بنفس المبلغ. اتركه لو المستحق
              ما حرّك كاش لسه.
            </span>
          </span>
        </label>

        <Field label="ملاحظات">
          <textarea value={o.note} onChange={(e) => setO({ ...o, note: e.target.value })} rows={2} className="field px-3 py-2.5 text-sm" />
        </Field>

        <button
          disabled={!valid || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await data.upsertObligation({ ...o, party: o.party.trim(), note: o.note.trim(), amount: num(amount) });
              onClose();
            } catch {
              setSaving(false);
            }
          }}
          className="btn-primary w-full py-3.5 text-sm"
        >
          <Check size={16} /> {saving ? "جارٍ الحفظ…" : "حفظ"}
        </button>
      </div>
    </Modal>
  );
}

function PaymentForm({ o, data, onClose }: { o: Obligation; data: AdminData; onClose: () => void }) {
  const remaining = remainingOf(o);
  const [amount, setAmount] = useState(String(remaining));
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const a = num(amount);
  const over = a > remaining + 1e-9;

  return (
    <Modal title={o.kind === "receivable" ? `سداد من ${o.party}` : `سداد إلى ${o.party}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-xl bg-surface2 p-3 text-sm text-muted">
          المتبقي:{" "}
          <b className="num text-ink" dir="ltr">
            {fmtMoney(remaining, o.currency)} {o.currency}
          </b>
          <span className="mt-1 block text-xs">
            السداد ده {o.kind === "receivable" ? "يدخل" : "يطلع من"} رصيد {o.currency} في السيولة تلقائياً.
          </span>
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="المبلغ المسدد">
            <NumInput value={amount} onChange={setAmount} suffix={o.currency} decimals={2} className="text-base" />
          </Field>
          <Field label="التاريخ">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
          </Field>
        </div>
        {over && <p className="text-xs font-semibold text-red-500">المبلغ أكبر من المتبقي.</p>}
        <Field label="ملاحظة">
          <input value={note} onChange={(e) => setNote(e.target.value)} className="field px-3 py-2.5 text-sm" />
        </Field>
        <button
          disabled={!a || over || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await data.upsertObligation({ ...o, payments: [...o.payments, { id: newId(), date, amount: a, note: note.trim() }] });
              onClose();
            } catch {
              setSaving(false);
            }
          }}
          className="btn-primary w-full py-3.5 text-sm"
        >
          <Check size={16} /> {saving ? "جارٍ الحفظ…" : a >= remaining - 1e-9 ? "تسجيل السداد وإقفال المستحق" : "تسجيل سداد جزئي"}
        </button>
      </div>
    </Modal>
  );
}

type Filter = "open" | "receivable" | "payable" | "overdue" | "settled" | "all";
const FILTERS: [Filter, string][] = [
  ["open", "المفتوحة"],
  ["receivable", "لنا"],
  ["payable", "علينا"],
  ["overdue", "متأخرة"],
  ["settled", "مسددة"],
  ["all", "الكل"],
];

export default function LedgerTab({ data }: { data: AdminData }) {
  const { obligations, usd } = data;
  const today = todayStr();
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const [form, setForm] = useState<Obligation | null>(null);
  const [paying, setPaying] = useState<Obligation | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const pos = useMemo(() => positions(obligations), [obligations]);
  const parties = useMemo(() => partyBalances(obligations, usd), [obligations, usd]);
  const totalRec = pos.reduce((s, p) => s + toUsd(p.receivable, p.currency, usd), 0);
  const totalPay = pos.reduce((s, p) => s + toUsd(p.payable, p.currency, usd), 0);
  const overdue = obligations.filter((o) => isOverdue(o, today));

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return obligations
      .filter((o) => {
        if (s && !o.party.toLowerCase().includes(s) && !o.note.toLowerCase().includes(s)) return false;
        switch (filter) {
          case "open":
            return !isSettled(o);
          case "receivable":
          case "payable":
            return o.kind === filter && !isSettled(o);
          case "overdue":
            return isOverdue(o, today);
          case "settled":
            return isSettled(o);
          default:
            return true;
        }
      })
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  }, [obligations, filter, q, today]);

  function exportAll() {
    downloadCsv(`master-digital-accounts-${today}.csv`, [
      ["الطرف", "النوع", "لنا/علينا", "العملة", "المبلغ", "المسدد", "المتبقي", "التاريخ", "الاستحقاق", "الحالة", "ملاحظات"],
      ...list.map((o) => [
        o.party,
        o.partyType === "company" ? "شركة" : "فرد",
        KIND_LABEL[o.kind],
        o.currency,
        o.amount,
        paidOf(o),
        remainingOf(o),
        o.date,
        o.dueDate,
        isSettled(o) ? "مسدد" : isOverdue(o, today) ? "متأخر" : "مفتوح",
        o.note,
      ]),
    ]);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="مستحق لنا" value={fmtUsd(totalRec)} sub="إجمالي ما على الأطراف" tone="good" icon={<HandCoins size={15} />} />
        <Stat label="مستحق علينا" value={fmtUsd(totalPay)} sub="إجمالي ما علينا للأطراف" icon={<HandCoins size={15} />} />
        <Stat label="الصافي" value={fmtUsd(totalRec - totalPay)} sub={totalRec >= totalPay ? "لصالحنا" : "علينا"} tone="gold" />
        <Stat label="متأخرة" value={String(overdue.length)} sub="تجاوزت تاريخ الاستحقاق" />
      </div>

      {pos.length > 0 && (
        <Panel title="الأرصدة المستحقة حسب العملة">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px] border-collapse text-right text-sm">
              <thead>
                <tr className="text-[11px] text-subtle">
                  <th className="px-2 py-2 font-semibold">العملة</th>
                  <th className="px-2 py-2 font-semibold">لنا</th>
                  <th className="px-2 py-2 font-semibold">علينا</th>
                  <th className="px-2 py-2 font-semibold">الصافي</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((p) => (
                  <tr key={p.currency} className="border-t border-border/50">
                    <td className="px-2 py-2.5 font-semibold text-ink">
                      {CURRENCIES[p.currency].flag} {p.currency}
                    </td>
                    <td className="num px-2 py-2.5 text-emerald-600 dark:text-emerald-400" dir="ltr">{fmtMoney(p.receivable, p.currency)}</td>
                    <td className="num px-2 py-2.5 text-red-500" dir="ltr">{fmtMoney(p.payable, p.currency)}</td>
                    <td className="num px-2 py-2.5 font-bold text-ink" dir="ltr">{fmtMoney(p.net, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {parties.length > 0 && (
        <Panel title="مين مديون لمين">
          <ul className="divide-y divide-border/50">
            {parties.slice(0, 8).map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-3 py-2.5">
                <button onClick={() => { setQ(p.party); setFilter("open"); }} className="flex min-w-0 items-center gap-2.5 text-right">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface2 text-muted">
                    {p.partyType === "company" ? <Building2 size={16} /> : <User size={16} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{p.party}</span>
                    <span className="num block text-[11px] text-subtle" dir="ltr">
                      {p.byCurrency.map((c) => `${fmtMoney(Math.abs(c.net), c.currency)} ${c.currency}`).join("  ")}
                    </span>
                  </span>
                </button>
                <span className="shrink-0 text-left">
                  <span className={`num block text-sm font-bold ${p.netUsd >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`} dir="ltr">
                    {fmtUsd(Math.abs(p.netUsd))}
                  </span>
                  <span className="block text-[11px] text-subtle">{p.netUsd >= 0 ? "مديون لينا" : "نحن مديونين ليه"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الطرف…" className="field py-2.5 pl-3 pr-9 text-sm" />
        </div>
        <button onClick={exportAll} disabled={!list.length} className="btn-ghost px-4 py-2.5 text-xs disabled:opacity-40">
          <Download size={14} /> تصدير
        </button>
        <button onClick={() => setForm(blankObligation())} className="btn-primary px-4 py-2.5 text-xs">
          <Plus size={14} /> مستحق جديد
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="تصفية">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold ${filter === k ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {obligations.length === 0 ? (
        <Empty
          title="لسه ما في مستحقات مسجلة"
          hint="سجّل أي مبلغ ليك عند فرد أو شركة، أو مبلغ عليك، وتابع السداد لحد ما الحساب يتقفل."
          action={<button onClick={() => setForm(blankObligation())} className="btn-primary px-5 py-3 text-sm"><Plus size={15} /> مستحق جديد</button>}
        />
      ) : list.length === 0 ? (
        <Empty title="لا يوجد مستحقات في التصفية دي" />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {list.map((o) => {
            const paid = paidOf(o);
            const remaining = remainingOf(o);
            const settled = isSettled(o);
            const late = isOverdue(o, today);
            return (
              <li key={o.id} className="card-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      <KindChip kind={o.kind} />
                      <span className="truncate font-semibold text-ink">{o.party}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-subtle">
                      <span className="num" dir="ltr">
                        {o.date}
                        {o.dueDate && ` → ${o.dueDate}`}
                      </span>
                      {o.createdByName && <> · {o.createdByName}</>}
                      {o.updatedByName && <> · آخر تعديل {o.updatedByName}</>}
                    </p>
                  </div>
                  <div className="shrink-0 text-left">
                    <p className="num text-lg font-bold text-ink" dir="ltr">
                      {fmtMoney(remaining, o.currency)} <span className="text-xs text-subtle">{o.currency}</span>
                    </p>
                    <p className="text-[11px] text-subtle">
                      {settled ? <span className="font-semibold text-emerald-600">مسدد بالكامل</span> : late ? <span className="font-semibold text-red-500">متأخر</span> : "متبقي"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface2">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, o.amount ? (paid / o.amount) * 100 : 0)}%` }} />
                </div>
                <p className="num mt-1.5 text-[11px] text-muted" dir="ltr">
                  {fmtMoney(paid, o.currency)} / {fmtMoney(o.amount, o.currency)} {o.currency}
                </p>
                {o.note && <p className="mt-2 text-xs leading-relaxed text-muted">{o.note}</p>}
                {o.payments.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-border/50 pt-2">
                    {o.payments.map((p) => (
                      <li key={p.id} className="num flex justify-between text-[11px] text-subtle" dir="ltr">
                        <span>{p.date}{p.note ? ` — ${p.note}` : ""}</span>
                        <span className="font-semibold text-muted">{fmtMoney(p.amount, o.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {!settled && (
                    <button onClick={() => setPaying(o)} className="btn-primary px-3.5 py-2 text-xs">
                      <HandCoins size={13} /> تسجيل سداد
                    </button>
                  )}
                  <button onClick={() => setForm(o)} className="btn-ghost px-3.5 py-2 text-xs">
                    <Pencil size={13} /> تعديل
                  </button>
                  {confirmId === o.id ? (
                    <button onClick={() => data.removeObligation(o.id)} className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white">
                      تأكيد الحذف
                    </button>
                  ) : (
                    <button onClick={() => setConfirmId(o.id)} className="btn-ghost px-3.5 py-2 text-xs text-red-500">
                      <Trash2 size={13} /> حذف
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form && <ObligationForm initial={form} data={data} onClose={() => setForm(null)} />}
      {paying && <PaymentForm o={paying} data={data} onClose={() => setPaying(null)} />}
    </div>
  );
}
