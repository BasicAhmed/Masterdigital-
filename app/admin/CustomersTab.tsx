"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Download, Pencil, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { fmtPct, fmtUsd } from "@/lib/format";
import { blankCustomer, downloadCsv, type Customer } from "@/lib/data";
import { customerStats, groupBy, type CustomerStat } from "@/lib/stats";
import { blankObligation, isSettled, positions, type Obligation } from "@/lib/books";
import { fmtMoney } from "@/lib/format";
import { ObligationForm } from "./LedgerTab";
import { todayStr } from "@/lib/format";
import type { AdminData } from "./AdminApp";
import { Empty, Field, Modal, Panel, RankBars, Stat } from "./ui";
import { TxDetail, TxTable } from "./TransactionsTab";
import { exportTransactions } from "./txExport";

function CustomerForm({ initial, data, onClose }: { initial: Customer; data: AdminData; onClose: () => void }) {
  const [c, setC] = useState(initial);
  const [saving, setSaving] = useState(false);
  const isNew = !data.customers.some((x) => x.id === initial.id);
  const dup = data.customers.find((x) => x.id !== c.id && c.phone.trim() && x.phone.replace(/\D/g, "") === c.phone.replace(/\D/g, ""));
  return (
    <Modal title={isNew ? "عميل جديد" : "تعديل بيانات العميل"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="اسم العميل *">
          <input autoFocus value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className="field px-3 py-2.5 text-sm" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رقم الهاتف / واتساب">
            <input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} dir="ltr" inputMode="tel" className="field px-3 py-2.5 font-mono text-sm" />
          </Field>
          <Field label="الدولة / المدينة">
            <input value={c.country} onChange={(e) => setC({ ...c, country: e.target.value })} className="field px-3 py-2.5 text-sm" />
          </Field>
        </div>
        {dup && <p className="text-[11px] font-semibold text-amber-600">تنبيه: الرقم ده مسجل للعميل «{dup.name}».</p>}
        <Field label="ملاحظات">
          <textarea value={c.notes} onChange={(e) => setC({ ...c, notes: e.target.value })} rows={3} className="field px-3 py-2.5 text-sm" />
        </Field>
        <button
          disabled={!c.name.trim() || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await data.upsertCustomer({ ...c, name: c.name.trim(), phone: c.phone.trim(), country: c.country.trim(), notes: c.notes.trim() });
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

function CustomerDetail({ stat, data, onBack }: { stat: CustomerStat; data: AdminData; onBack: () => void }) {
  const { customer } = stat;
  const mine = useMemo(() => data.txs.filter((t) => t.customerId === customer.id), [data.txs, customer.id]);
  const routes = useMemo(() => groupBy(mine, (t) => `${t.from} → ${t.to}`).sort((a, b) => b.count - a.count).slice(0, 5), [mine]);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = mine.find((t) => t.id === openId);
  // This customer's open balances from the accounts page.
  const owed = useMemo(() => positions(data.obligations.filter((o) => o.customerId === customer.id && !isSettled(o))), [data.obligations, customer.id]);
  const [oblForm, setOblForm] = useState<Obligation | null>(null);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        <ArrowRight size={15} /> كل العملاء
      </button>

      <div className="card-sm flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-extrabold text-ink">{customer.name}</h2>
          <p className="mt-1 text-sm text-muted">
            <span className="num" dir="ltr">{customer.phone || "بدون رقم"}</span>
            {customer.country && <> · {customer.country}</>}
            <> · عميل منذ <span className="num" dir="ltr">{customer.createdAt.slice(0, 10)}</span></>
          </p>
          {customer.notes && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{customer.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => data.openTxForm({ customerId: customer.id })} className="btn-primary px-4 py-2.5 text-xs">
            <Plus size={14} /> معاملة لهذا العميل
          </button>
          <button onClick={() => setEditing(true)} className="btn-ghost px-4 py-2.5 text-xs">
            <Pencil size={14} /> تعديل
          </button>
          <button onClick={() => exportTransactions(mine, `customer-${customer.name}`)} disabled={!mine.length} className="btn-ghost px-4 py-2.5 text-xs disabled:opacity-40">
            <Download size={14} /> كشف حساب
          </button>
          {mine.length === 0 &&
            (confirming ? (
              <button onClick={async () => { await data.removeCustomer(customer.id); onBack(); }} className="rounded-full bg-red-600 px-4 py-2.5 text-xs font-semibold text-white">
                تأكيد الحذف
              </button>
            ) : (
              <button onClick={() => setConfirming(true)} className="btn-ghost px-4 py-2.5 text-xs text-red-500">
                <Trash2 size={14} /> حذف
              </button>
            ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="عدد المعاملات" value={String(stat.count)} sub={stat.allCount !== stat.count ? `${stat.allCount - stat.count} غير مكتملة` : "مكتملة"} />
        <Stat label="حجم التحويلات" value={fmtUsd(stat.volume)} sub={`متوسط المعاملة ${fmtUsd(stat.avgTicket)}`} />
        <Stat label="الإيراد" value={fmtUsd(stat.revenue)} />
        <Stat label="الربح من العميل" value={fmtUsd(stat.profit)} sub={`هامش ${fmtPct(stat.margin)}`} tone="good" />
      </div>

      <div className="card-sm flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs font-medium text-muted">الحساب مع العميل</p>
          {owed.length === 0 ? (
            <p className="mt-1 text-sm text-ink">لا توجد مبالغ مستحقة بينكم.</p>
          ) : (
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {owed.map((p) => (
                <span key={p.currency} className={`num font-bold ${p.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`} dir="ltr">
                  {p.net >= 0 ? "لنا" : "علينا"} {fmtMoney(Math.abs(p.net), p.currency)} {p.currency}
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setOblForm({ ...blankObligation(), party: customer.name, customerId: customer.id })} className="btn-ghost px-3.5 py-2 text-xs">
            <Plus size={13} /> مستحق جديد
          </button>
          <button onClick={() => data.goTo("ledger")} className="btn-ghost px-3.5 py-2 text-xs">
            صفحة الحسابات
          </button>
        </div>
      </div>

      {routes.length > 0 && (
        <Panel title="أكثر المسارات استخداماً">
          <RankBars rows={routes.map((r) => ({ key: r.key, label: <span className="font-mono text-xs" dir="ltr">{r.label}</span>, value: r.count, display: `${r.count}`, sub: fmtUsd(r.volume) }))} />
        </Panel>
      )}

      <h3 className="pt-2 font-display text-sm font-bold text-ink">سجل المعاملات ({mine.length})</h3>
      {mine.length ? <TxTable txs={mine} hideCustomer onOpen={(t) => setOpenId(t.id)} /> : <Empty title="لا توجد معاملات لهذا العميل بعد" />}

      {editing && <CustomerForm initial={customer} data={data} onClose={() => setEditing(false)} />}
      {oblForm && <ObligationForm initial={oblForm} data={data} onClose={() => setOblForm(null)} />}
      {open && <TxDetail tx={open} data={data} onClose={() => setOpenId(null)} />}
    </div>
  );
}

type Sort = "volume" | "profit" | "count" | "recent" | "name";

export default function CustomersTab({ data }: { data: AdminData }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("volume");
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(() => customerStats(data.customers, data.txs), [data.customers, data.txs]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    const f = stats.filter(
      (x) => !s || x.customer.name.toLowerCase().includes(s) || (digits && x.customer.phone.replace(/\D/g, "").includes(digits)) || x.customer.country.toLowerCase().includes(s)
    );
    const by: Record<Sort, (a: CustomerStat, b: CustomerStat) => number> = {
      volume: (a, b) => b.volume - a.volume,
      profit: (a, b) => b.profit - a.profit,
      count: (a, b) => b.count - a.count,
      recent: (a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""),
      name: (a, b) => a.customer.name.localeCompare(b.customer.name, "ar"),
    };
    return f.sort(by[sort]);
  }, [stats, q, sort]);

  const open = stats.find((x) => x.customer.id === openId);
  if (open) return <CustomerDetail stat={open} data={data} onBack={() => setOpenId(null)} />;

  function exportAll() {
    downloadCsv(`master-digital-customers-${todayStr()}.csv`, [
      ["الاسم", "الهاتف", "الدولة", "عدد المعاملات", "الحجم (USD)", "الإيراد (USD)", "الربح (USD)", "آخر معاملة", "تاريخ الإضافة", "ملاحظات"],
      ...list.map((x) => [x.customer.name, x.customer.phone, x.customer.country, x.count, Math.round(x.volume * 100) / 100, Math.round(x.revenue * 100) / 100, Math.round(x.profit * 100) / 100, x.lastDate ?? "", x.customer.createdAt.slice(0, 10), x.customer.notes]),
    ]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم، الهاتف أو الدولة…" className="field py-2.5 pl-3 pr-9 text-sm" />
        </div>
        <div className="w-36 shrink-0">
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="الترتيب" className="field px-3 py-2.5 text-xs font-semibold">
          <option value="volume">الأعلى حجماً</option>
          <option value="profit">الأعلى ربحاً</option>
          <option value="count">الأكثر معاملات</option>
          <option value="recent">آخر تعامل</option>
          <option value="name">الاسم</option>
        </select>
        </div>
        <button onClick={exportAll} disabled={!list.length} className="btn-ghost px-4 py-2.5 text-xs disabled:opacity-40">
          <Download size={14} /> تصدير
        </button>
        <button onClick={() => setAdding(true)} className="btn-primary px-4 py-2.5 text-xs">
          <UserPlus size={14} /> عميل جديد
        </button>
      </div>

      <p className="text-xs text-muted">
        <b className="num text-ink">{list.length}</b> عميل
      </p>

      {data.customers.length === 0 ? (
        <Empty title="لسه ما في عملاء" hint="أضف عملاءك هنا، أو أضفهم مباشرة وقت تسجيل المعاملة." action={<button onClick={() => setAdding(true)} className="btn-primary px-5 py-3 text-sm"><UserPlus size={15} /> عميل جديد</button>} />
      ) : list.length === 0 ? (
        <Empty title="لا يوجد عميل مطابق" />
      ) : (
        <>
        {/* Phone: one card per customer */}
        <ul className="space-y-2 sm:hidden">
          {list.map((x) => (
            <li key={x.customer.id}>
              <button onClick={() => setOpenId(x.customer.id)} className="card-sm block w-full p-3.5 text-right">
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-ink">{x.customer.name}</span>
                    <span className="num block text-xs text-subtle" dir="ltr">{x.customer.phone || "—"}</span>
                  </span>
                  <span className="num shrink-0 font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">{fmtUsd(x.profit)}</span>
                </span>
                <span className="mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted">
                  <span><b className="num text-ink">{x.count}</b> معاملة</span>
                  <span>الحجم <b className="num text-ink" dir="ltr">{fmtUsd(x.volume)}</b></span>
                  <span className="num" dir="ltr">{x.lastDate ?? "—"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="card-sm hidden overflow-x-auto p-0 sm:block">
          <table className="w-full min-w-[640px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-border bg-surface2/60 text-[11px] text-subtle">
                <th className="px-4 py-3 font-semibold">العميل</th>
                <th className="px-4 py-3 font-semibold">الهاتف</th>
                <th className="px-4 py-3 font-semibold">المعاملات</th>
                <th className="px-4 py-3 font-semibold">الحجم</th>
                <th className="px-4 py-3 font-semibold">الربح</th>
                <th className="px-4 py-3 font-semibold">آخر معاملة</th>
              </tr>
            </thead>
            <tbody>
              {list.map((x) => (
                <tr key={x.customer.id} onClick={() => setOpenId(x.customer.id)} className="cursor-pointer border-t border-border/50 transition-colors hover:bg-primary/5">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{x.customer.name}</p>
                    {x.customer.country && <p className="text-[11px] text-subtle">{x.customer.country}</p>}
                  </td>
                  <td className="num px-4 py-3 text-xs text-muted" dir="ltr">{x.customer.phone || "—"}</td>
                  <td className="num px-4 py-3 font-semibold text-ink">{x.count}</td>
                  <td className="num px-4 py-3 font-semibold text-ink" dir="ltr">{fmtUsd(x.volume)}</td>
                  <td className="num px-4 py-3 font-semibold text-emerald-600 dark:text-emerald-400" dir="ltr">{fmtUsd(x.profit)}</td>
                  <td className="num px-4 py-3 text-xs text-muted" dir="ltr">{x.lastDate ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {adding && <CustomerForm initial={blankCustomer()} data={data} onClose={() => setAdding(false)} />}
    </div>
  );
}
