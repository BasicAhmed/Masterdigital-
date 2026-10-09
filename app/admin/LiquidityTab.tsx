"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Check, Download, Trash2, TriangleAlert, Wallet } from "lucide-react";
import { CURRENCIES, CURRENCY_LIST, type CurrencyCode } from "@/lib/currencies";
import { fmtMoney, fmtUsd, formatSmart, todayStr } from "@/lib/format";
import { downloadCsv } from "@/lib/data";
import { accountLabel, accountsOf, validAccount, type MovementKind } from "@/lib/books";
import { newId } from "@/lib/store";
import type { AdminData } from "./AdminApp";
import { Field, Modal, NumInput, Panel } from "./ui";

const SOURCE_LABEL = { manual: "يدوي", transaction: "معاملة", obligation: "حسابات" } as const;
const SOURCE_TONE = {
  manual: "bg-primary/10 text-primary",
  transaction: "bg-surface2 text-muted",
  obligation: "bg-accent/15 text-accent",
} as const;

function MovementForm({ kind, currency, data, onClose }: { kind: MovementKind; currency: CurrencyCode; data: AdminData; onClose: () => void }) {
  const [cur, setCur] = useState<CurrencyCode>(currency);
  const [account, setAccount] = useState<string>(accountsOf(currency)[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayStr());
  const [note, setNote] = useState("");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  const a = parseFloat(amount) || 0;
  const r = parseFloat(rate) || 0;
  const hasRate = cur !== "USDT"; // USDT is the base — always 1
  const myAvg = data.costs[cur]?.avg;
  const market = data.usd[cur];
  // a withdrawal with a rate: what he gets vs what that money cost him
  const gain = kind === "withdraw" && a && r && myAvg ? a / r - a / myAvg : null;
  const cats = accountsOf(cur);
  const curBalance = data.balances.find((b) => b.currency === cur);
  const available = cats.length ? curBalance?.accounts.find((x) => x.id === account)?.balance ?? 0 : curBalance?.balance ?? 0;
  const availableLabel = cats.length ? accountLabel(cur, account) : "";

  return (
    <Modal title={kind === "deposit" ? "إيداع في السيولة" : "سحب من السيولة"} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-muted">
          {kind === "deposit"
            ? "استخدمه للرصيد الافتتاحي، ضخ رأس مال، أو تصحيح بعد الجرد."
            : "استخدمه لسحب أرباح، مصروفات، أو تصحيح بعد الجرد."}{" "}
          المعاملات وسداد المستحقات بتتحسب لوحدها — ما تسجلها هنا.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="العملة">
            <select
              value={cur}
              onChange={(e) => {
                const next = e.target.value as CurrencyCode;
                setCur(next);
                setRate("");
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
          {cats.length > 0 && (
            <Field label="الصنف" hint="المكان اللي حتتحرك فيه السيولة.">
              <select value={account} onChange={(e) => setAccount(e.target.value)} className="field px-3 py-2.5 text-sm font-semibold">
                {cats.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
                <option value="">غير مصنّف</option>
              </select>
            </Field>
          )}
          <Field label="المبلغ" hint={`الرصيد الحالي${availableLabel ? ` (${availableLabel})` : ""}: ${fmtMoney(available, cur)} ${cur}`}>
            <NumInput value={amount} onChange={setAmount} suffix={cur} decimals={2} placeholder="0" className="text-base" />
          </Field>
          {hasRate && (
            <Field
              label={`السعر — كم ${cur} = 1 USDT`}
              hint={
                kind === "deposit"
                  ? `بكم اشتريت؟ بيحدد تكلفتك الحقيقية${myAvg ? ` (متوسطك الآن ${formatSmart(myAvg)})` : ""}`
                  : `بكم بعت؟ بيحسب ربح/خسارة الصرف${myAvg ? ` (متوسطك ${formatSmart(myAvg)})` : ""}`
              }
            >
              <NumInput value={rate} onChange={setRate} suffix={cur} placeholder={market ? formatSmart(market) : ""} className="text-base" />
            </Field>
          )}
          <Field label="التاريخ">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
          </Field>
          <Field label="البيان">
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "deposit" ? "رصيد افتتاحي" : "سحب أرباح"} className="field px-3 py-2.5 text-sm" />
          </Field>
        </div>
        {kind === "deposit" && hasRate && !r && a > 0 && (
          <p className="text-xs text-muted">بدون سعر، الإيداع بيزيد الرصيد بس وما بيدخل في حساب التكلفة.</p>
        )}
        {gain !== null && (
          <p className={`rounded-xl p-2.5 text-xs font-semibold ${gain >= 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-red-500/10 text-red-600"}`}>
            {gain >= 0 ? "ربح صرف" : "خسارة صرف"}: <span className="num" dir="ltr">{fmtUsd(Math.abs(gain))}</span> — بعت بـ{" "}
            <span className="num" dir="ltr">{formatSmart(r)}</span> ومتوسطك <span className="num" dir="ltr">{formatSmart(myAvg!)}</span>
          </p>
        )}
        {kind === "withdraw" && a > available && (
          <p className="text-xs font-semibold text-amber-600">السحب أكبر من الرصيد الحالي — الرصيد حيبقى بالسالب.</p>
        )}
        <button
          disabled={!a || saving}
          onClick={async () => {
            setSaving(true);
            try {
              await data.upsertMovement({ id: newId(), date, currency: cur, kind, amount: a, note: note.trim(), account: validAccount(cur, account), ...(hasRate && r > 0 ? { rate: r } : {}), createdAt: new Date().toISOString() });
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

export default function LiquidityTab({ data }: { data: AdminData }) {
  const { balances, liquidity } = data;
  const [form, setForm] = useState<{ kind: MovementKind; currency: CurrencyCode } | null>(null);
  const [filter, setFilter] = useState<CurrencyCode | "ALL">("ALL");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const totalUsd = balances.reduce((s, b) => s + b.usd, 0);
  const negative = balances.filter((b) => b.balance < -1e-9);
  const lines = useMemo(() => liquidity.filter((l) => filter === "ALL" || l.currency === filter), [liquidity, filter]);
  const maxUsd = Math.max(...balances.map((b) => Math.abs(b.usd)), 1e-9);

  function exportAll() {
    downloadCsv(`master-digital-liquidity-${todayStr()}.csv`, [
      ["العملة", "الرصيد", "القيمة (USD)", "إجمالي الداخل", "إجمالي الخارج"],
      ...balances.map((b) => [b.currency, Math.round(b.balance * 100) / 100, Math.round(b.usd * 100) / 100, Math.round(b.inflow * 100) / 100, Math.round(b.outflow * 100) / 100]),
      [],
      ["العملة", "الصنف", "الرصيد"],
      ...balances.flatMap((b) => b.accounts.map((a) => [b.currency, a.label, Math.round(a.balance * 100) / 100])),
      [],
      ["التاريخ", "العملة", "الصنف", "الحركة", "المصدر", "البيان", "بواسطة", "السعر"],
      ...lines.map((l) => [l.date, l.currency, accountsOf(l.currency).length ? accountLabel(l.currency, l.account) : "", Math.round(l.delta * 100) / 100, SOURCE_LABEL[l.source], l.label, l.by ?? "", l.rate ?? ""]),
    ]);
  }

  return (
    <div className="space-y-5">
      <div className="navy-field on-navy relative overflow-hidden rounded-2xl p-5 sm:p-6" style={{ boxShadow: "inset 0 2px 0 #c9a227" }}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium text-white/75">
              <Wallet size={14} /> إجمالي السيولة المتاحة
            </p>
            <p className="num mt-1 text-4xl font-bold sm:text-5xl" dir="ltr">
              {fmtUsd(totalUsd)}
            </p>
            <p className="mt-1 text-xs text-white/70">مجموع أرصدة كل العملات محوّل للدولار بسعر السوق الحالي</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setForm({ kind: "deposit", currency: "USDT" })} className="btn-gold px-4 py-2.5 text-xs">
              <ArrowDownToLine size={14} /> إيداع
            </button>
            <button onClick={() => setForm({ kind: "withdraw", currency: "USDT" })} className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-4 py-2.5 text-xs font-bold text-white hover:border-white/70">
              <ArrowUpFromLine size={14} /> سحب
            </button>
          </div>
        </div>
      </div>

      {negative.length > 0 && (
        <p className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-ink">
          <TriangleAlert size={16} className="mt-0.5 shrink-0 text-red-500" />
          <span>
            رصيد بالسالب في: <b dir="ltr">{negative.map((b) => b.currency).join(", ")}</b> — يعني في مبالغ صُرفت أكتر من المسجّل. سجّل الرصيد
            الافتتاحي أو الإيداعات الناقصة عشان الأرقام تبقى صحيحة.
          </span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {balances.map((b) => {
          const c = CURRENCIES[b.currency];
          const neg = b.balance < -1e-9;
          return (
            <div key={b.currency} className={`card-sm p-4 ${neg ? "ring-1 ring-red-500/40" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="text-xl">{c.flag}</span> {c.name}
                </p>
                <span className="num text-[11px] font-semibold text-subtle">{b.currency}</span>
              </div>
              <p className={`num mt-3 text-2xl font-bold ${neg ? "text-red-500" : "text-ink"}`} dir="ltr">
                {fmtMoney(b.balance, b.currency)}
              </p>
              <p className="num text-xs text-muted" dir="ltr">
                ≈ {fmtUsd(b.usd)}
              </p>
              {b.currency !== "USDT" && (
                <p className="mt-1 text-[11px] text-subtle">
                  {data.costs[b.currency] ? (
                    <>
                      تكلفتك: <b className="num text-ink" dir="ltr">{formatSmart(data.costs[b.currency]!.avg)}</b> لكل USDT
                    </>
                  ) : (
                    "التكلفة من سعر السوق — سجّل إيداع بسعر"
                  )}
                </p>
              )}
              {b.accounts.length > 0 && (
                <ul className="mt-3 space-y-1 border-t border-border/50 pt-2.5">
                  {b.accounts.map((a) => (
                    <li key={a.id || "none"} className="flex items-center justify-between gap-2 text-xs">
                      <span className={a.id ? "text-muted" : "font-semibold text-amber-600"}>{a.label}</span>
                      <span className={`num font-semibold ${a.balance < -1e-9 ? "text-red-500" : "text-ink"}`} dir="ltr">
                        {fmtMoney(a.balance, b.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface2">
                <div className={`h-full rounded-full ${neg ? "bg-red-500" : "bg-primary"}`} style={{ width: `${Math.max(2, (Math.abs(b.usd) / maxUsd) * 100)}%` }} />
              </div>
              <div className="num mt-3 flex justify-between text-[11px] text-subtle" dir="ltr">
                <span>↓ {fmtMoney(b.inflow, b.currency)}</span>
                <span>↑ {fmtMoney(b.outflow, b.currency)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setForm({ kind: "deposit", currency: b.currency })} className="btn-ghost flex-1 py-2 text-xs">
                  إيداع
                </button>
                <button onClick={() => setForm({ kind: "withdraw", currency: b.currency })} className="btn-ghost flex-1 py-2 text-xs">
                  سحب
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Panel
        title="حركة السيولة"
        action={
          <button onClick={exportAll} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Download size={13} /> تصدير
          </button>
        }
      >
        <p className="mb-3 text-xs leading-relaxed text-muted">
          الرصيد بيتحسب تلقائياً من ثلاثة مصادر: المعاملات المكتملة (يدخل ما دفعه العميل ويطلع ما استلمه المستلم)، سداد المستحقات في
          صفحة الحسابات، والإيداع والسحب اليدوي.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="العملة">
          {(["ALL", ...CURRENCY_LIST.map((c) => c.code)] as const).map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              aria-pressed={filter === c}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${filter === c ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"}`}
            >
              {c === "ALL" ? "الكل" : c}
            </button>
          ))}
        </div>
        {lines.length === 0 ? (
          <p className="py-8 text-center text-sm text-subtle">لا توجد حركات بعد — ابدأ بتسجيل الرصيد الافتتاحي لكل عملة.</p>
        ) : (
          <ul className="divide-y divide-border/50">
            {lines.slice(0, 120).map((l, i) => (
              <li key={`${l.refId}-${i}`} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className={`chip ${SOURCE_TONE[l.source]}`}>{SOURCE_LABEL[l.source]}</span>
                    {accountsOf(l.currency).length > 0 && <span className="chip bg-surface2 text-muted">{accountLabel(l.currency, l.account)}</span>}
                    <span className="truncate text-sm text-ink">{l.label}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-subtle">
                    <span className="num" dir="ltr">{l.date}</span>
                    {l.by && <> · {l.by}</>}
                    {l.rate && (
                      <>
                        {" · بسعر "}
                        <span className="num" dir="ltr">{formatSmart(l.rate)}</span>
                      </>
                    )}
                    {(() => {
                      const x = l.source === "manual" ? data.exchange.find((e) => e.id === l.refId) : undefined;
                      return x ? (
                        <span className={x.gainUsd >= 0 ? "text-emerald-600" : "text-red-500"}>
                          {" · "}
                          {x.gainUsd >= 0 ? "ربح" : "خسارة"} <span className="num" dir="ltr">{fmtUsd(Math.abs(x.gainUsd))}</span>
                        </span>
                      ) : null;
                    })()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`num text-sm font-bold ${l.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`} dir="ltr">
                    {l.delta >= 0 ? "+" : "−"}
                    {fmtMoney(Math.abs(l.delta), l.currency)} <span className="text-[10px] text-subtle">{l.currency}</span>
                  </span>
                  {l.source === "manual" &&
                    (confirmId === l.refId ? (
                      <button onClick={() => data.removeMovement(l.refId)} className="rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white">
                        تأكيد
                      </button>
                    ) : (
                      <button onClick={() => setConfirmId(l.refId)} aria-label="حذف الحركة" className="rounded-lg p-1 text-subtle hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {lines.length > 120 && <p className="mt-3 text-center text-xs text-subtle">يُعرض آخر 120 حركة — التصدير يشمل الكل.</p>}
      </Panel>

      {form && <MovementForm kind={form.kind} currency={form.currency} data={data} onClose={() => setForm(null)} />}
    </div>
  );
}
