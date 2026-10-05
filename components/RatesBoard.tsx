"use client";

import { ChevronLeft, TriangleAlert } from "lucide-react";
import { SELECT_PAIR_EVENT, type SelectPairDetail } from "./Calculator";
import { CURRENCIES, PAIRS, routeKey, type CurrencyCode } from "@/lib/currencies";
import { fmt, fmtRate } from "@/lib/format";
import type { Route } from "@/lib/routes";

function open(from: CurrencyCode, to: CurrencyCode) {
  window.dispatchEvent(new CustomEvent<SelectPairDetail>(SELECT_PAIR_EVENT, { detail: { from, to } }));
}

/** The daily board, laid out like Master Digital's own rate sheet:
 *  amount · from · to · sell · buy. Tapping a price opens that direction in
 *  the calculator. */
export default function RatesBoard({ routes }: { routes: Route[] }) {
  const get = (f: string, t: string) => routes.find((r) => r.id === routeKey(f, t));

  return (
    <section id="rates" className="border-t border-border py-16 sm:py-24">
      <div className="container-page">
        <p className="eyebrow">أسعار اليوم</p>
        <h2 className="section-heading mt-3">كل الأسعار في جدول واحد واضح.</h2>
        <p className="mt-3 max-w-xl text-muted">
          <b className="text-ink">بيع</b>: المبلغ اللي تستلمه مقابل مبلغ التحويل. <b className="text-ink">شراء</b>: المبلغ
          اللي تدفعه عشان تستلم مبلغ التحويل. اضغط على أي سعر عشان تحسبه مباشرة.
        </p>

        <div className="card mt-8 overflow-x-auto p-0">
          <table className="w-full min-w-[620px] border-collapse text-right text-sm">
            <thead>
              <tr className="bg-brand-navy text-xs text-white">
                <th className="px-5 py-4 font-semibold">المبلغ للتحويل</th>
                <th className="px-5 py-4 font-semibold">من</th>
                <th className="px-5 py-4 font-semibold">إلى</th>
                <th className="bg-red-600 px-5 py-4 font-semibold">بيع</th>
                <th className="bg-emerald-600 px-5 py-4 font-semibold">شراء</th>
              </tr>
            </thead>
            <tbody>
              {PAIRS.map((p, i) => {
                const sell = get(p.base, p.quote);
                const buy = get(p.quote, p.base);
                const b = CURRENCIES[p.base];
                const q = CURRENCIES[p.quote];
                const cell = (r: Route | undefined, tone: string, from: CurrencyCode, to: CurrencyCode) => (
                  <td className={`p-0 ${tone}`}>
                    <button
                      onClick={() => open(from, to)}
                      title="احسب في الحاسبة"
                      className="group flex w-full items-center justify-between gap-2 px-5 py-3.5 text-right transition-colors hover:bg-primary/10"
                    >
                      {r && r.active ? (
                        <span className="num text-base font-bold" dir="ltr">
                          {fmtRate(r.rate)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-subtle">غير متاح حالياً</span>
                      )}
                      <ChevronLeft size={14} className="text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </td>
                );
                return (
                  <tr key={`${p.base}${p.quote}`} className={`border-t border-border/60 ${i % 2 ? "bg-surface2/40" : ""}`}>
                    <td className="num px-5 py-3.5 text-base font-bold text-ink" dir="ltr">
                      {fmt(p.unit)}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-ink">
                      <span className="ml-2 text-lg">{b.flag}</span>
                      {b.name}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-ink">
                      <span className="ml-2 text-lg">{q.flag}</span>
                      {q.name}
                    </td>
                    {cell(sell, "bg-red-500/[0.07] text-red-600 dark:text-red-400", p.base, p.quote)}
                    {cell(buy, "bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-400", p.quote, p.base)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-brand-navy px-4 py-3 text-xs font-medium leading-relaxed text-white">
          <TriangleAlert size={15} className="mt-0.5 shrink-0 text-amber-300" />
          <span>
            <b className="text-amber-300">ملاحظة:</b> يتم خصم رسوم التحويل إن وُجدت من المبلغ المستلم.
          </span>
        </p>
      </div>
    </section>
  );
}
