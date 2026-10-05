"use client";

import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { CURRENCY_LIST, ROUTE_KEYS, routeKey, findPair } from "@/lib/currencies";
import { fmt, fmtMoney, fmtPct, fmtRate, fmtUsd } from "@/lib/format";
import { STATUS_LABEL, type Transaction, type TxStatus } from "@/lib/data";
import { totals } from "@/lib/stats";
import type { AdminData } from "./AdminApp";
import { Empty, Modal, RouteTag, StatusChip } from "./ui";
import { exportTransactions } from "./txExport";

export function TxDetail({ tx, data, onClose }: { tx: Transaction; data: AdminData; onClose: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const pair = findPair(tx.from, tx.to);
  const rows: [string, React.ReactNode][] = [
    ["التاريخ", <span className="num" dir="ltr" key="d">{tx.date}</span>],
    ["العميل", tx.customerName],
    ["المسار", <RouteTag key="r" from={tx.from} to={tx.to} />],
    ["المبلغ", `${fmtMoney(tx.amount, tx.from)} ${tx.from}`],
    ["سعر العميل", `${fmtRate(tx.rate)} ${pair ? `${pair.quote} / ${fmt(pair.unit)} ${pair.base}` : ""}`],
    ["سعر التكلفة", fmtRate(tx.cost)],
    ["الرسوم", tx.fee ? `${fmtMoney(tx.fee, tx.feeSide === "from" ? tx.from : tx.to)} ${tx.feeSide === "from" ? tx.from : tx.to}` : "—"],
    ["التكاليف", tx.expense ? `${fmtMoney(tx.expense, tx.expenseSide === "from" ? tx.from : tx.to)} ${tx.expenseSide === "from" ? tx.from : tx.to}` : "—"],
    ["المستلم يستلم", `${fmtMoney(tx.payout, tx.to)} ${tx.to}`],
    ["هامش المسار", fmtPct(tx.marginPercent)],
    ["حجم المعاملة", fmtUsd(tx.volumeUsd)],
    ["الإيراد", fmtUsd(tx.revenueUsd)],
    ["صافي الربح", fmtUsd(tx.profitUsd)],
    ["طريقة الدفع", tx.payMethod || "—"],
    ["طريقة التسليم", tx.payoutMethod || "—"],
    ["المستلم", tx.recipient || "—"],
    ["ملاحظات", tx.notes || "—"],
  ];
  return (
    <Modal title={`معاملة ${tx.ref}`} onClose={onClose}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <StatusChip status={tx.status} />
        <div className="flex gap-1.5">
          {(Object.keys(STATUS_LABEL) as TxStatus[])
            .filter((s) => s !== tx.status)
            .map((s) => (
              <button key={s} onClick={() => data.upsertTx({ ...tx, status: s })} className="btn-ghost px-3 py-1.5 text-[11px]">
                ← {STATUS_LABEL[s]}
              </button>
            ))}
        </div>
      </div>
      <dl className="divide-y divide-border/50 rounded-2xl border border-border/70">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-4 px-3.5 py-2.5 text-sm">
            <dt className="shrink-0 text-muted">{k}</dt>
            <dd className="text-left font-semibold text-ink" dir="auto">
              {v}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            onClose();
            data.openTxForm({ edit: tx });
          }}
          className="btn-primary flex-1 py-3 text-sm"
        >
          <Pencil size={15} /> تعديل
        </button>
        {confirming ? (
          <button
            onClick={async () => {
              await data.removeTx(tx.id);
              onClose();
            }}
            className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white"
          >
            <Trash2 size={15} /> تأكيد الحذف
          </button>
        ) : (
          <button onClick={() => setConfirming(true)} className="btn-ghost px-5 py-3 text-sm text-red-500">
            <Trash2 size={15} /> حذف
          </button>
        )}
      </div>
    </Modal>
  );
}

export function TxTable({ txs, onOpen, hideCustomer }: { txs: Transaction[]; onOpen: (t: Transaction) => void; hideCustomer?: boolean }) {
  return (
    <div className="card-sm overflow-x-auto p-0">
      <table className="w-full min-w-[760px] border-collapse text-right text-sm">
        <thead>
          <tr className="border-b border-border bg-surface2/60 text-[11px] text-subtle">
            <th className="px-4 py-3 font-semibold">المرجع</th>
            <th className="px-4 py-3 font-semibold">التاريخ</th>
            {!hideCustomer && <th className="px-4 py-3 font-semibold">العميل</th>}
            <th className="px-4 py-3 font-semibold">المسار</th>
            <th className="px-4 py-3 font-semibold">المبلغ</th>
            <th className="px-4 py-3 font-semibold">المستلم يستلم</th>
            <th className="px-4 py-3 font-semibold">الربح</th>
            <th className="px-4 py-3 font-semibold">الحالة</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((t) => (
            <tr key={t.id} onClick={() => onOpen(t)} className="cursor-pointer border-t border-border/50 transition-colors hover:bg-primary/5">
              <td className="num px-4 py-3 text-xs font-semibold text-primary" dir="ltr">{t.ref}</td>
              <td className="num px-4 py-3 text-xs text-muted" dir="ltr">{t.date}</td>
              {!hideCustomer && <td className="max-w-[160px] truncate px-4 py-3 font-medium text-ink">{t.customerName}</td>}
              <td className="px-4 py-3"><RouteTag from={t.from} to={t.to} /></td>
              <td className="num px-4 py-3 font-semibold text-ink" dir="ltr">{fmtMoney(t.amount, t.from)} <span className="text-[10px] text-subtle">{t.from}</span></td>
              <td className="num px-4 py-3 text-ink" dir="ltr">{fmtMoney(t.payout, t.to)} <span className="text-[10px] text-subtle">{t.to}</span></td>
              <td className={`num px-4 py-3 font-semibold ${t.profitUsd < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`} dir="ltr">{fmtUsd(t.profitUsd)}</td>
              <td className="px-4 py-3"><StatusChip status={t.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TransactionsTab({ data }: { data: AdminData }) {
  const { txs, customers } = data;
  const [q, setQ] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [route, setRoute] = useState("");
  const [currency, setCurrency] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return txs.filter(
      (t) =>
        (!s || t.ref.toLowerCase().includes(s) || t.customerName.toLowerCase().includes(s) || t.recipient.toLowerCase().includes(s) || t.notes.toLowerCase().includes(s)) &&
        (!customerId || t.customerId === customerId) &&
        (!route || routeKey(t.from, t.to) === route) &&
        (!currency || t.from === currency || t.to === currency) &&
        (!status || t.status === status) &&
        (!dateFrom || t.date >= dateFrom) &&
        (!dateTo || t.date <= dateTo)
    );
  }, [txs, q, customerId, route, currency, status, dateFrom, dateTo]);

  const sum = totals(filtered);
  const activeFilters = [customerId, route, currency, status, dateFrom, dateTo].filter(Boolean).length;
  const clear = () => {
    setQ(""); setCustomerId(""); setRoute(""); setCurrency(""); setStatus(""); setDateFrom(""); setDateTo("");
  };
  const open = txs.find((t) => t.id === openId);
  const sel = "field px-3 py-2.5 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالمرجع، العميل، المستلم…" className="field py-2.5 pl-3 pr-9 text-sm" />
        </div>
        <button onClick={() => setShowFilters((v) => !v)} className={`btn-ghost px-4 py-2.5 text-xs ${activeFilters ? "border-primary text-primary" : ""}`}>
          <SlidersHorizontal size={14} /> فلترة{activeFilters ? ` (${activeFilters})` : ""}
        </button>
        <button onClick={() => exportTransactions(filtered)} disabled={!filtered.length} className="btn-ghost px-4 py-2.5 text-xs disabled:opacity-40">
          <Download size={14} /> تصدير CSV
        </button>
        <span className="hidden sm:block">
          <button onClick={() => data.openTxForm()} className="btn-primary px-4 py-2.5 text-xs">
            <Plus size={14} /> معاملة جديدة
          </button>
        </span>
      </div>

      {showFilters && (
        <div className="card-sm grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <label><span className="label">العميل</span>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={sel}>
              <option value="">الكل</option>
              {[...customers].sort((a, b) => a.name.localeCompare(b.name, "ar")).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label><span className="label">المسار</span>
            <select value={route} onChange={(e) => setRoute(e.target.value)} className={sel} dir="ltr">
              <option value="">الكل</option>
              {ROUTE_KEYS.map((r) => <option key={routeKey(r.from, r.to)} value={routeKey(r.from, r.to)}>{r.from} → {r.to}</option>)}
            </select>
          </label>
          <label><span className="label">العملة</span>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={sel}>
              <option value="">الكل</option>
              {CURRENCY_LIST.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </label>
          <label><span className="label">الحالة</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
              <option value="">الكل</option>
              {(Object.keys(STATUS_LABEL) as TxStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label><span className="label">من تاريخ</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} dir="ltr" className={`${sel} font-mono`} />
          </label>
          <label><span className="label">إلى تاريخ</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} dir="ltr" className={`${sel} font-mono`} />
          </label>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span><b className="num text-ink">{filtered.length}</b> معاملة</span>
        <span>الحجم: <b className="num text-ink" dir="ltr">{fmtUsd(sum.volume)}</b></span>
        <span>الإيراد: <b className="num text-ink" dir="ltr">{fmtUsd(sum.revenue)}</b></span>
        <span>الربح: <b className="num text-ink" dir="ltr">{fmtUsd(sum.profit)}</b></span>
        <span className="text-subtle">(الأرقام للمعاملات المكتملة فقط)</span>
        {(activeFilters > 0 || q) && (
          <button onClick={clear} className="inline-flex items-center gap-1 font-semibold text-primary">
            <X size={12} /> مسح الفلاتر
          </button>
        )}
      </div>

      {txs.length === 0 ? (
        <Empty
          title="لسه ما في معاملات"
          hint="سجّل أول معاملة: اختار العميل، ثم المسار والمبلغ — والنظام يحسب المستلم والإيراد والربح تلقائياً."
          action={<button onClick={() => data.openTxForm()} className="btn-primary px-5 py-3 text-sm"><Plus size={15} /> معاملة جديدة</button>}
        />
      ) : filtered.length === 0 ? (
        <Empty title="لا توجد معاملات مطابقة" hint="جرّب تغيّر البحث أو تمسح الفلاتر." />
      ) : (
        <TxTable txs={filtered.slice(0, 500)} onOpen={(t) => setOpenId(t.id)} />
      )}
      {filtered.length > 500 && <p className="text-center text-xs text-subtle">يُعرض أول 500 معاملة — التصدير يشمل الكل ({filtered.length}).</p>}

      {open && <TxDetail tx={open} data={data} onClose={() => setOpenId(null)} />}
    </div>
  );
}
