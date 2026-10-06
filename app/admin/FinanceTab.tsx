"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, BadgePercent, Banknote, Download, Plus, TrendingUp, Users, Wallet } from "lucide-react";
import { CURRENCIES, type CurrencyCode } from "@/lib/currencies";
import { fmt, fmtPct, fmtUsd, todayStr } from "@/lib/format";
import { downloadCsv, STATUS_LABEL, type TxStatus } from "@/lib/data";
import { positions } from "@/lib/books";
import { toUsd } from "@/lib/calc";
import { customerStats, dailySeries, groupBy, inRange, monthlySeries, periodRange, PERIODS, totals, type PeriodKey } from "@/lib/stats";
import type { AdminData } from "./AdminApp";
import { Empty, Panel, RankBars, Stat } from "./ui";

const r2 = (n: number) => Math.round(n * 100) / 100;

function delta(now: number, prev: number): React.ReactNode {
  if (!prev) return now ? "لا يوجد شهر سابق للمقارنة" : "—";
  const d = ((now - prev) / Math.abs(prev)) * 100;
  return (
    <span className={d >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}>
      <span dir="ltr">{d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(0)}%</span> عن الشهر الماضي
    </span>
  );
}

/** Daily profit, last 30 days. One series, so the title names it and no
 *  legend is needed; each bar carries its exact figures on hover/focus. */
function DailyBars({ series }: { series: { date: string; profit: number; volume: number; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...series.map((s) => Math.abs(s.profit)), 1e-9);
  const h = hover !== null ? series[hover] : null;
  const total = series.reduce((s, x) => s + x.profit, 0);
  return (
    <div>
      <p className="mb-3 h-5 text-xs text-muted">
        {h ? (
          <>
            <b className="num text-ink" dir="ltr">{h.date}</b> · ربح <b className="num text-ink" dir="ltr">{fmtUsd(h.profit)}</b> · حجم{" "}
            <b className="num text-ink" dir="ltr">{fmtUsd(h.volume)}</b> · {h.count} معاملة
          </>
        ) : (
          <>
            إجمالي 30 يوم: <b className="num text-ink" dir="ltr">{fmtUsd(total)}</b> — مرّر على أي يوم للتفاصيل
          </>
        )}
      </p>
      <div className="flex h-36 items-end gap-[2px] border-b border-border" dir="ltr" onMouseLeave={() => setHover(null)}>
        {series.map((s, i) => (
          <button
            key={s.date}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            aria-label={`${s.date}: ربح ${fmtUsd(s.profit)}`}
            className="group flex h-full flex-1 items-end"
          >
            <span
              className={`w-full rounded-t transition-opacity ${s.profit < 0 ? "bg-red-500" : "bg-primary"} ${hover !== null && hover !== i ? "opacity-40" : ""}`}
              style={{ height: s.profit ? `${Math.max(3, (Math.abs(s.profit) / max) * 100)}%` : "1px" }}
            />
          </button>
        ))}
      </div>
      <div className="num mt-1.5 flex justify-between text-[10px] text-subtle" dir="ltr">
        <span>{series[0]?.date.slice(5)}</span>
        <span>{series[Math.floor(series.length / 2)]?.date.slice(5)}</span>
        <span>{series[series.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}

export default function FinanceTab({ data }: { data: AdminData }) {
  const { txs, customers, goTo, balances, obligations, usd } = data;
  const liquidityUsd = balances.reduce((s, b) => s + b.usd, 0);
  const owed = positions(obligations);
  const owedToUs = owed.reduce((s, p) => s + toUsd(p.receivable, p.currency, usd), 0);
  const weOwe = owed.reduce((s, p) => s + toUsd(p.payable, p.currency, usd), 0);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [custom, setCustom] = useState({ from: "", to: "" });

  const range = periodRange(period, custom);
  const scoped = useMemo(() => txs.filter((t) => inRange(t, range)), [txs, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const T = totals(scoped);

  const today = totals(txs.filter((t) => inRange(t, periodRange("today"))));
  const month = totals(txs.filter((t) => inRange(t, periodRange("month"))));
  const lastMonth = totals(txs.filter((t) => inRange(t, periodRange("lastMonth"))));

  const routes = useMemo(() => groupBy(scoped, (t) => `${t.from}_${t.to}`, (t) => `${t.from} → ${t.to}`), [scoped]);
  const byCount = [...routes].sort((a, b) => b.count - a.count).slice(0, 6);
  const byProfit = [...routes].sort((a, b) => b.profit - a.profit).slice(0, 6);
  const cust = useMemo(() => customerStats(customers, scoped).filter((c) => c.count > 0), [customers, scoped]);
  const topCust = [...cust].sort((a, b) => b.profit - a.profit).slice(0, 6);
  const sentBy = useMemo(() => groupBy(scoped, (t) => t.from).sort((a, b) => b.volume - a.volume), [scoped]);
  const methods = useMemo(() => groupBy(scoped.filter((t) => t.payMethod), (t) => t.payMethod).sort((a, b) => b.count - a.count), [scoped]);
  const daily = useMemo(() => dailySeries(txs, 30), [txs]);
  const monthly = useMemo(() => monthlySeries(txs, 6), [txs]);

  const statusCount = (s: TxStatus) => scoped.filter((t) => t.status === s).length;
  const pendingValue = scoped.filter((t) => t.status === "pending").reduce((s, t) => s + t.volumeUsd, 0);
  const newCustomers = customers.filter((c) => c.createdAt.slice(0, 10) >= range.from && c.createdAt.slice(0, 10) <= range.to).length;
  const routeLabel = (l: string) => <span className="font-mono text-xs" dir="ltr">{l}</span>;

  function exportReport() {
    const label = PERIODS.find(([k]) => k === period)?.[1] ?? "";
    downloadCsv(`master-digital-finance-report-${todayStr()}.csv`, [
      ["تقرير مالي — Master Digital", label, range.from === "0000-00-00" ? "" : range.from, range.to === "9999-12-31" ? "" : range.to],
      [],
      ["الملخص"],
      ["عدد المعاملات المكتملة", T.count],
      ["حجم التحويلات (USD)", r2(T.volume)],
      ["الإيرادات (USD)", r2(T.revenue)],
      ["صافي الربح (USD)", r2(T.profit)],
      ["هامش الربح %", r2(T.margin)],
      ["متوسط الربح للمعاملة (USD)", r2(T.avgProfit)],
      ["قيد التنفيذ", statusCount("pending")],
      ["ملغاة", statusCount("cancelled")],
      [],
      ["المسارات", "عدد المعاملات", "الحجم (USD)", "الإيراد (USD)", "الربح (USD)", "الهامش %"],
      ...[...routes].sort((a, b) => b.profit - a.profit).map((r) => [r.label, r.count, r2(r.volume), r2(r.revenue), r2(r.profit), r2(r.margin)]),
      [],
      ["العملاء", "عدد المعاملات", "الحجم (USD)", "الإيراد (USD)", "الربح (USD)", "الهامش %"],
      ...[...cust].sort((a, b) => b.profit - a.profit).map((c) => [c.customer.name, c.count, r2(c.volume), r2(c.revenue), r2(c.profit), r2(c.margin)]),
      [],
      ["الشهر", "عدد المعاملات", "الحجم (USD)", "الإيراد (USD)", "الربح (USD)", "الهامش %"],
      ...monthly.map((m) => [m.month, m.count, r2(m.volume), r2(m.revenue), r2(m.profit), r2(m.margin)]),
    ]);
  }

  if (txs.length === 0) {
    return (
      <Empty
        title="لوحة المالية جاهزة — في انتظار أول معاملة"
        hint="كل الأرقام هنا تتحسب من المعاملات الفعلية المسجلة في النظام: الحجم، الإيراد، الربح، أفضل المسارات والعملاء."
        action={
          <button onClick={() => data.openTxForm()} className="btn-primary px-5 py-3 text-sm">
            <Plus size={15} /> سجّل أول معاملة
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Today / month — always visible, independent of the period filter */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="navy-field on-navy relative overflow-hidden rounded-2xl p-5 shadow-card" style={{ boxShadow: "inset 0 2px 0 #c9a227" }}>
          <p className="text-xs font-medium text-white/75">أداء اليوم</p>
          <p className="num mt-1 text-4xl font-bold" dir="ltr">{fmtUsd(today.profit)}</p>
          <p className="mt-1 text-xs text-white/80">
            صافي ربح · <span className="num">{today.count}</span> معاملة · حجم <span className="num" dir="ltr">{fmtUsd(today.volume)}</span>
          </p>
        </div>
        <div className="card-sm p-5">
          <p className="text-xs font-medium text-muted">أداء هذا الشهر</p>
          <p className="num mt-1 text-4xl font-bold text-ink" dir="ltr">{fmtUsd(month.profit)}</p>
          <p className="mt-1 text-xs text-muted">
            صافي ربح · <span className="num">{month.count}</span> معاملة · حجم <span className="num" dir="ltr">{fmtUsd(month.volume)}</span>
          </p>
          <p className="mt-1 text-[11px] text-subtle">{delta(month.profit, lastMonth.profit)}</p>
        </div>
      </div>

      {/* Position right now: cash on hand and what is owed either way — same figures as their own pages */}
      <div className="grid gap-3 sm:grid-cols-3">
        <button onClick={() => goTo("liquidity")} className="card-sm p-4 text-right transition-colors hover:border-primary/60">
          <p className="text-xs font-medium text-muted">السيولة المتاحة</p>
          <p className="num mt-1.5 text-2xl font-bold text-ink" dir="ltr">{fmtUsd(liquidityUsd)}</p>
          <p className="mt-1 text-[11px] text-subtle">مجموع أرصدة كل العملات</p>
        </button>
        <button onClick={() => goTo("ledger")} className="card-sm p-4 text-right transition-colors hover:border-primary/60">
          <p className="text-xs font-medium text-muted">مستحق لنا</p>
          <p className="num mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">{fmtUsd(owedToUs)}</p>
          <p className="mt-1 text-[11px] text-subtle">مبالغ على أفراد وشركات</p>
        </button>
        <button onClick={() => goTo("ledger")} className="card-sm p-4 text-right transition-colors hover:border-primary/60">
          <p className="text-xs font-medium text-muted">مستحق علينا</p>
          <p className="num mt-1.5 text-2xl font-bold text-red-500" dir="ltr">{fmtUsd(weOwe)}</p>
          <p className="mt-1 text-[11px] text-subtle">الصافي: <span className="num" dir="ltr">{fmtUsd(owedToUs - weOwe)}</span></p>
        </button>
      </div>

      {/* Period filter — one row, scopes everything below it */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="الفترة">
          {PERIODS.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setPeriod(k)}
              aria-pressed={period === k}
              className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                period === k ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-1.5" dir="ltr">
            <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} aria-label="من تاريخ" className="field w-auto px-2.5 py-1.5 font-mono text-xs" />
            <span className="text-subtle">→</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} aria-label="إلى تاريخ" className="field w-auto px-2.5 py-1.5 font-mono text-xs" />
          </div>
        )}
        <button onClick={exportReport} className="btn-ghost mr-auto px-4 py-2 text-xs">
          <Download size={14} /> تصدير التقرير
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="إجمالي المعاملات" value={fmt(T.count)} sub={`${statusCount("pending")} قيد التنفيذ · ${statusCount("cancelled")} ملغاة`} icon={<ArrowLeftRight size={15} />} />
        <Stat label="حجم التحويلات" value={fmtUsd(T.volume)} sub={`متوسط المعاملة ${fmtUsd(T.avgTicket)}`} icon={<Banknote size={15} />} />
        <Stat label="الإيرادات" value={fmtUsd(T.revenue)} sub="فرق السعر + الرسوم" icon={<Wallet size={15} />} />
        <Stat label="صافي الربح" value={fmtUsd(T.profit)} sub={`متوسط ${fmtUsd(T.avgProfit)} للمعاملة`} icon={<TrendingUp size={15} />} tone="good" />
        <Stat label="هامش الربح" value={fmtPct(T.margin)} sub="الربح ÷ حجم التحويلات" icon={<BadgePercent size={15} />} tone="gold" />
        <Stat label="العملاء النشطون" value={fmt(cust.length)} sub={`${newCustomers} عميل جديد في الفترة`} icon={<Users size={15} />} />
      </div>

      {statusCount("pending") > 0 && (
        <button onClick={() => goTo("transactions")} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-right text-sm text-ink">
          <span>
            <b className="num">{statusCount("pending")}</b> معاملة {STATUS_LABEL.pending} بقيمة <b className="num" dir="ltr">{fmtUsd(pendingValue)}</b> — غير محسوبة في الأرباح لحد ما تكتمل.
          </span>
          <span className="shrink-0 text-xs font-semibold text-primary">عرض ←</span>
        </button>
      )}

      <Panel title="صافي الربح اليومي — آخر 30 يوم (USD)">
        <DailyBars series={daily} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="أكثر المسارات استخداماً">
          <RankBars rows={byCount.map((r) => ({ key: r.key, label: routeLabel(r.label), value: r.count, display: `${r.count} معاملة`, sub: fmtUsd(r.volume) }))} />
        </Panel>
        <Panel title="أكثر المسارات ربحاً">
          <RankBars rows={byProfit.map((r) => ({ key: r.key, label: routeLabel(r.label), value: r.profit, display: fmtUsd(r.profit), sub: `هامش ${fmtPct(r.margin)}` }))} />
        </Panel>
        <Panel title="أفضل العملاء (حسب الربح)" action={<button onClick={() => goTo("customers")} className="text-xs font-semibold text-primary">كل العملاء ←</button>}>
          <RankBars rows={topCust.map((c) => ({ key: c.customer.id, label: c.customer.name, value: c.profit, display: fmtUsd(c.profit), sub: `${c.count} · ${fmtUsd(c.volume)}` }))} />
        </Panel>
        <Panel title="حجم التحويلات حسب عملة الإرسال">
          <RankBars
            rows={sentBy.map((r) => ({
              key: r.key,
              label: <span>{CURRENCIES[r.key as CurrencyCode]?.flag} {CURRENCIES[r.key as CurrencyCode]?.name ?? r.key}</span>,
              value: r.volume,
              display: fmtUsd(r.volume),
              sub: `${r.count} معاملة`,
            }))}
          />
        </Panel>
        {methods.length > 0 && (
          <Panel title="طرق دفع العملاء">
            <RankBars rows={methods.map((r) => ({ key: r.key, label: r.label, value: r.count, display: `${r.count} معاملة`, sub: fmtUsd(r.volume) }))} />
          </Panel>
        )}
      </div>

      <Panel title="الأداء الشهري — آخر 6 شهور">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-right text-sm">
            <thead>
              <tr className="text-[11px] text-subtle">
                <th className="px-2 py-2 font-semibold">الشهر</th>
                <th className="px-2 py-2 font-semibold">المعاملات</th>
                <th className="px-2 py-2 font-semibold">الحجم</th>
                <th className="px-2 py-2 font-semibold">الإيراد</th>
                <th className="px-2 py-2 font-semibold">الربح</th>
                <th className="px-2 py-2 font-semibold">الهامش</th>
              </tr>
            </thead>
            <tbody>
              {[...monthly].reverse().map((m) => (
                <tr key={m.month} className="border-t border-border/50">
                  <td className="num px-2 py-2.5 font-semibold text-ink" dir="ltr">{m.month}</td>
                  <td className="num px-2 py-2.5 text-ink">{m.count}</td>
                  <td className="num px-2 py-2.5 text-ink" dir="ltr">{fmtUsd(m.volume)}</td>
                  <td className="num px-2 py-2.5 text-ink" dir="ltr">{fmtUsd(m.revenue)}</td>
                  <td className="num px-2 py-2.5 font-semibold text-emerald-600 dark:text-emerald-400" dir="ltr">{fmtUsd(m.profit)}</td>
                  <td className="num px-2 py-2.5 text-muted" dir="ltr">{fmtPct(m.margin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <p className="text-center text-[11px] leading-relaxed text-subtle">
        كل الأرقام محسوبة من المعاملات المكتملة المسجلة في النظام، ومحوّلة للدولار بسعر يوم تسجيل المعاملة.
      </p>
    </div>
  );
}
