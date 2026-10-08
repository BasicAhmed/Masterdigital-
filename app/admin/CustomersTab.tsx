"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Download, FileUp, MessageCircle, Pencil, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { fmtPct, fmtUsd } from "@/lib/format";
import { blankCustomer, downloadCsv, nextCustomerCode, TITLES, type Customer, type Gender } from "@/lib/data";
import {
  customerStatus,
  customerWaLink,
  displayName,
  IMPORT_TEMPLATE_HEADER,
  planImport,
  readImportRows,
  STATUS_META,
  STATUS_ORDER,
  type CustomerStatus,
  type ImportPlan,
} from "@/lib/customers";
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
  const dupCode = c.code ? data.customers.find((x) => x.id !== c.id && x.code === c.code) : undefined;
  return (
    <Modal title={isNew ? "عميل جديد" : "تعديل بيانات العميل"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-[6rem_1fr] gap-3">
          <Field label="رقم العميل">
            <input
              value={c.code ?? ""}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                setC({ ...c, code: Number.isFinite(n) ? n : undefined });
              }}
              dir="ltr"
              inputMode="numeric"
              className="field px-3 py-2.5 font-mono text-sm"
            />
          </Field>
          <Field label="اسم العميل *">
            <input autoFocus value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className="field px-3 py-2.5 text-sm" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="اللقب">
            <select
              value={c.title ?? ""}
              onChange={(e) => {
                const title = e.target.value;
                const gender: Gender = /ة$|الأخت/.test(title) ? "female" : title ? "male" : c.gender ?? "";
                setC({ ...c, title, gender });
              }}
              className="field px-3 py-2.5 text-sm"
            >
              <option value="">—</option>
              {TITLES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="الجنس">
            <select value={c.gender ?? ""} onChange={(e) => setC({ ...c, gender: e.target.value as Gender })} className="field px-3 py-2.5 text-sm">
              <option value="">—</option>
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رقم الهاتف / واتساب">
            <input value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} dir="ltr" inputMode="tel" className="field px-3 py-2.5 font-mono text-sm" />
          </Field>
          <Field label="الدولة / المدينة">
            <input value={c.country} onChange={(e) => setC({ ...c, country: e.target.value })} className="field px-3 py-2.5 text-sm" />
          </Field>
        </div>
        {dup && <p className="text-[11px] font-semibold text-amber-600">تنبيه: الرقم ده مسجل للعميل «{dup.name}».</p>}
        {dupCode && <p className="text-[11px] font-semibold text-amber-600">تنبيه: رقم العميل {c.code} مستخدم لـ «{dupCode.name}».</p>}
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
  const st = customerStatus(stat);
  const wa = customerWaLink(customer);
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
          <p className="flex flex-wrap items-center gap-2">
            {customer.code != null && <span className="num rounded-lg bg-surface2 px-2 py-0.5 text-xs font-bold text-muted">#{customer.code}</span>}
            <span className={`chip ${STATUS_META[st.status].tone}`}>{STATUS_META[st.status].label}</span>
          </p>
          <h2 className="mt-1.5 font-display text-xl font-extrabold text-ink">{displayName(customer)}</h2>
          <p className="mt-1 text-sm text-muted">
            <span className="num" dir="ltr">{customer.phone || "بدون رقم"}</span>
            {customer.country && <> · {customer.country}</>}
            <> · عميل منذ <span className="num" dir="ltr">{customer.createdAt.slice(0, 10)}</span></>
          </p>
          {customer.notes && <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{customer.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="btn-ghost px-4 py-2.5 text-xs text-emerald-600">
              <MessageCircle size={14} /> واتساب
            </a>
          )}
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

      <div className="card-sm grid grid-cols-2 gap-3 p-4 text-sm sm:grid-cols-4">
        {(
          [
            ["المسار المفضل", stat.topRoute ?? "—", true],
            ["أول معاملة", stat.firstDate ?? "—", true],
            ["آخر معاملة", stat.lastDate ?? "—", true],
            ["أيام الغياب", st.daysAbsent != null ? `${st.daysAbsent} يوم` : "—", false],
          ] as const
        ).map(([label, value, ltr]) => (
          <div key={label}>
            <p className="text-[11px] text-muted">{label}</p>
            <p className="num mt-0.5 font-semibold text-ink" dir={ltr ? "ltr" : undefined}>
              {value}
            </p>
          </div>
        ))}
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

function ImportModal({ data, onClose }: { data: AdminData; onClose: () => void }) {
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const total = plan ? plan.create.length + plan.update.length : 0;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPlan(null);
    setFileName(file.name);
    if (!/\.csv$/i.test(file.name)) return setError("الملف لازم يكون CSV. من Excel: حفظ باسم ← CSV UTF-8.");
    const { rows, error: err } = readImportRows(await file.text());
    if (err) return setError(err);
    setPlan(planImport(rows, data.customers));
  }

  async function run() {
    if (!plan || !total) return;
    setProgress(0);
    try {
      await data.importCustomers([...plan.create, ...plan.update], setProgress);
      setFinished(true);
    } catch {
      setError("وقف الاستيراد في النص — اللي اتحفظ ظاهر في القائمة. جرّب تاني بنفس الملف، ما حيتكرر أي عميل.");
      setProgress(null);
    }
  }

  return (
    <Modal title="استيراد عملاء" onClose={onClose}>
      <div className="space-y-4 text-sm">
        {finished ? (
          <>
            <p className="rounded-2xl bg-emerald-500/10 p-4 font-semibold text-emerald-700 dark:text-emerald-400">
              ✅ تم: {plan!.create.length} عميل جديد و {plan!.update.length} تحديث.
            </p>
            <button onClick={onClose} className="btn-primary w-full py-3 text-sm">
              تمام
            </button>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-muted">
              ملف CSV أول سطر فيه العناوين: <span className="font-semibold text-ink">{IMPORT_TEMPLATE_HEADER.join("، ")}</span>. «الاسم» بس
              مطلوب. العميل الموجود (بنفس رقم العميل أو نفس الهاتف) بيتحدث وما بيتكرر، وملاحظاته ما بتتمسح.
            </p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border p-6 text-center hover:border-primary/60">
              <FileUp size={22} className="text-primary" />
              <span className="font-semibold text-ink">{fileName || "اختار الملف"}</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            <button
              onClick={() => downloadCsv("customers-template.csv", [IMPORT_TEMPLATE_HEADER])}
              className="text-xs font-semibold text-primary"
            >
              تنزيل ملف فاضي بالعناوين
            </button>

            {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-500">{error}</p>}

            {plan && (
              <div className="rounded-2xl bg-surface2 p-4">
                <p className="font-semibold text-ink">قبل ما نحفظ:</p>
                <ul className="mt-2 space-y-1 text-xs text-muted">
                  <li>
                    عملاء جدد: <b className="num text-ink">{plan.create.length}</b>
                  </li>
                  <li>
                    عملاء موجودين حيتحدثوا: <b className="num text-ink">{plan.update.length}</b>
                  </li>
                  {plan.unchanged > 0 && (
                    <li>
                      موجودين وما في تغيير: <b className="num text-ink">{plan.unchanged}</b>
                    </li>
                  )}
                  {plan.skipped.length > 0 && (
                    <li className="text-amber-600">
                      متروكين: <b className="num">{plan.skipped.length}</b> — {plan.skipped.slice(0, 3).join(" · ")}
                      {plan.skipped.length > 3 ? " …" : ""}
                    </li>
                  )}
                </ul>
              </div>
            )}

            <button onClick={run} disabled={!total || progress !== null} className="btn-primary w-full py-3.5 text-sm">
              <Check size={16} />{" "}
              {progress !== null ? `جارٍ الحفظ… ${progress} / ${total}` : total ? `استيراد ${total} عميل` : "استيراد"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

type Sort = "code" | "recent" | "count" | "profit" | "volume" | "name";

export default function CustomersTab({ data }: { data: AdminData }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("code");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "ALL">("ALL");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const stats = useMemo(
    () => customerStats(data.customers, data.txs).map((x) => ({ ...x, ...customerStatus(x) })),
    [data.customers, data.txs]
  );
  const counts = useMemo(() => {
    const m = new Map<CustomerStatus, number>();
    for (const x of stats) m.set(x.status, (m.get(x.status) ?? 0) + 1);
    return m;
  }, [stats]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const digits = s.replace(/\D/g, "");
    const f = stats.filter(
      (x) =>
        (statusFilter === "ALL" || x.status === statusFilter) &&
        (!s ||
          x.customer.name.toLowerCase().includes(s) ||
          (digits && x.customer.phone.replace(/\D/g, "").includes(digits)) ||
          (digits && String(x.customer.code ?? "") === digits) ||
          x.customer.country.toLowerCase().includes(s))
    );
    const by: Record<Sort, (a: (typeof stats)[number], b: (typeof stats)[number]) => number> = {
      code: (a, b) => (a.customer.code ?? 1e9) - (b.customer.code ?? 1e9),
      recent: (a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""),
      count: (a, b) => b.count - a.count,
      profit: (a, b) => b.profit - a.profit,
      volume: (a, b) => b.volume - a.volume,
      name: (a, b) => a.customer.name.localeCompare(b.customer.name, "ar"),
    };
    return f.sort(by[sort]);
  }, [stats, q, sort, statusFilter]);

  const open = stats.find((x) => x.customer.id === openId);
  if (open) return <CustomerDetail stat={open} data={data} onBack={() => setOpenId(null)} />;

  function exportAll() {
    downloadCsv(`master-digital-customers-${todayStr()}.csv`, [
      [...IMPORT_TEMPLATE_HEADER, "الحالة", "المسار المفضل", "عدد المعاملات", "الربح (USD)", "أول معاملة", "آخر معاملة", "أيام الغياب"],
      ...list.map((x) => [
        x.customer.code ?? "",
        x.customer.name,
        x.customer.title ?? "",
        x.customer.phone,
        x.customer.gender === "male" ? "ذكر" : x.customer.gender === "female" ? "أنثى" : "",
        x.customer.country,
        x.customer.notes,
        STATUS_META[x.status].label,
        x.topRoute ?? "",
        x.count,
        Math.round(x.profit * 100) / 100,
        x.firstDate ?? "",
        x.lastDate ?? "",
        x.daysAbsent ?? "",
      ]),
    ]);
  }

  const newCustomer = () => blankCustomer(nextCustomerCode(data.customers));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم، الهاتف أو رقم العميل…" className="field py-2.5 pl-3 pr-9 text-sm" />
        </div>
        <div className="w-36 shrink-0">
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="الترتيب" className="field px-3 py-2.5 text-xs font-semibold">
            <option value="code">رقم العميل</option>
            <option value="recent">آخر تعامل</option>
            <option value="count">الأكثر معاملات</option>
            <option value="profit">الأعلى ربحاً</option>
            <option value="volume">الأعلى حجماً</option>
            <option value="name">الاسم</option>
          </select>
        </div>
        <button onClick={() => setImporting(true)} className="btn-ghost px-4 py-2.5 text-xs">
          <FileUp size={14} /> استيراد
        </button>
        <button onClick={exportAll} disabled={!list.length} className="btn-ghost px-4 py-2.5 text-xs disabled:opacity-40">
          <Download size={14} /> تصدير
        </button>
        <button onClick={() => setAdding(true)} className="btn-primary px-4 py-2.5 text-xs">
          <UserPlus size={14} /> عميل جديد
        </button>
      </div>

      {/* Status filter — same groups as the old customer sheet */}
      {data.customers.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="فلترة بالحالة">
          {(["ALL", ...STATUS_ORDER] as const).map((k) => {
            const n = k === "ALL" ? stats.length : counts.get(k) ?? 0;
            if (k !== "ALL" && !n) return null;
            return (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                aria-pressed={statusFilter === k}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                  statusFilter === k ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"
                }`}
              >
                {k === "ALL" ? "الكل" : STATUS_META[k].label} <span className="num opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {data.customers.length === 0 ? (
        <Empty
          title="لسه ما في عملاء"
          hint="استورد قائمة عملائك من ملف، أو أضفهم واحد واحد."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={() => setImporting(true)} className="btn-primary px-5 py-3 text-sm">
                <FileUp size={15} /> استيراد من ملف
              </button>
              <button onClick={() => setAdding(true)} className="btn-ghost px-5 py-3 text-sm">
                <UserPlus size={15} /> عميل جديد
              </button>
            </div>
          }
        />
      ) : list.length === 0 ? (
        <Empty title="لا يوجد عميل مطابق" />
      ) : (
        <>
          {/* Phone: one card per customer */}
          <ul className="space-y-2 sm:hidden">
            {list.map((x) => {
              const wa = customerWaLink(x.customer);
              return (
                <li key={x.customer.id} className="card-sm p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => setOpenId(x.customer.id)} className="min-w-0 flex-1 text-right">
                      <span className="flex items-center gap-1.5">
                        {x.customer.code != null && <span className="num text-[11px] font-bold text-subtle">#{x.customer.code}</span>}
                        <span className="truncate font-semibold text-ink">{displayName(x.customer)}</span>
                      </span>
                      <span className="num block text-xs text-subtle" dir="ltr">
                        {x.customer.phone || "—"}
                      </span>
                    </button>
                    {wa && (
                      <a href={wa} target="_blank" rel="noreferrer" aria-label="واتساب" className="shrink-0 rounded-full bg-emerald-500/15 p-2 text-emerald-600">
                        <MessageCircle size={16} />
                      </a>
                    )}
                  </div>
                  <button onClick={() => setOpenId(x.customer.id)} className="mt-2 flex w-full flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs text-muted">
                    <span className={`chip ${STATUS_META[x.status].tone}`}>{STATUS_META[x.status].label}</span>
                    <span>
                      <b className="num text-ink">{x.count}</b> معاملة
                    </span>
                    {x.daysAbsent != null && <span>غايب {x.daysAbsent} يوم</span>}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="card-sm hidden overflow-x-auto p-0 sm:block">
            <table className="w-full min-w-[820px] border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-border bg-surface2/60 text-[11px] text-subtle">
                  <th className="px-3 py-3 font-semibold">#</th>
                  <th className="px-3 py-3 font-semibold">العميل</th>
                  <th className="px-3 py-3 font-semibold">الهاتف</th>
                  <th className="px-3 py-3 font-semibold">الحالة</th>
                  <th className="px-3 py-3 font-semibold">المسار المفضل</th>
                  <th className="px-3 py-3 font-semibold">المعاملات</th>
                  <th className="px-3 py-3 font-semibold">الربح</th>
                  <th className="px-3 py-3 font-semibold">آخر معاملة</th>
                  <th className="px-3 py-3" aria-label="واتساب" />
                </tr>
              </thead>
              <tbody>
                {list.map((x) => {
                  const wa = customerWaLink(x.customer);
                  return (
                    <tr key={x.customer.id} onClick={() => setOpenId(x.customer.id)} className="cursor-pointer border-t border-border/50 transition-colors hover:bg-primary/5">
                      <td className="num px-3 py-3 text-xs text-subtle">{x.customer.code ?? "—"}</td>
                      <td className="px-3 py-3">
                        <p className="font-semibold text-ink">{displayName(x.customer)}</p>
                        {x.customer.country && <p className="text-[11px] text-subtle">{x.customer.country}</p>}
                      </td>
                      <td className="num px-3 py-3 text-xs text-muted" dir="ltr">
                        {x.customer.phone || "—"}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`chip whitespace-nowrap ${STATUS_META[x.status].tone}`}>{STATUS_META[x.status].label}</span>
                      </td>
                      <td className="num px-3 py-3 text-xs text-muted" dir="ltr">
                        {x.topRoute ?? "—"}
                      </td>
                      <td className="num px-3 py-3 font-semibold text-ink">{x.count}</td>
                      <td className="num px-3 py-3 font-semibold text-emerald-600 dark:text-emerald-400" dir="ltr">
                        {fmtUsd(x.profit)}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted">
                        <span className="num block" dir="ltr">
                          {x.lastDate ?? "—"}
                        </span>
                        {x.daysAbsent != null && <span className="text-[10px] text-subtle">قبل {x.daysAbsent} يوم</span>}
                      </td>
                      <td className="px-3 py-3">
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label="واتساب"
                            className="inline-flex rounded-full bg-emerald-500/15 p-1.5 text-emerald-600"
                          >
                            <MessageCircle size={14} />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {adding && <CustomerForm initial={newCustomer()} data={data} onClose={() => setAdding(false)} />}
      {importing && <ImportModal data={data} onClose={() => setImporting(false)} />}
    </div>
  );
}
