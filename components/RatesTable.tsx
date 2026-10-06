"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, Search, Star } from "lucide-react";
import { FavoriteStar } from "./CalcExtras";
import { useFavorites } from "@/lib/favorites";
import { SELECT_PAIR_EVENT, type SelectPairDetail } from "./Calculator";
import { CURRENCIES, type CurrencyCode } from "@/lib/corridors";
import { formatRate } from "@/lib/format";
import type { RateRow } from "@/lib/rates";

function formatUpdated(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function openInCalculator(from: CurrencyCode, to: CurrencyCode) {
  window.dispatchEvent(new CustomEvent<SelectPairDetail>(SELECT_PAIR_EVENT, { detail: { from, to } }));
}

export default function RatesTable({ rates, disabledFlows = [] }: { rates: RateRow[]; disabledFlows?: string[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CurrencyCode | "ALL" | "FAV">("ALL");
  const { favorites } = useFavorites();

  const currencies = useMemo(() => {
    const set = new Set<CurrencyCode>();
    rates.forEach((r) => {
      set.add(r.from);
      set.add(r.to);
    });
    return Array.from(set);
  }, [rates]);

  const filtered = rates.filter((r) => {
    const matchesFilter =
      filter === "ALL" ? true : filter === "FAV" ? favorites.includes(`${r.from}_${r.to}`) : r.from === filter || r.to === filter;
    const q = query.trim().toUpperCase();
    const matchesQuery =
      !q ||
      r.from.includes(q) ||
      r.to.includes(q) ||
      CURRENCIES[r.from].name.toUpperCase().includes(q) ||
      CURRENCIES[r.to].name.toUpperCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  return (
    <section id="rates" className="py-16 sm:py-24">
      <div className="container-page">
        <h2 className="section-heading">أسعار اليوم</h2>
        <p className="mt-4 max-w-lg text-muted">
          الأسعار تتحدث خلال اليوم. اضغط على أي سطر عشان تحسبه مباشرة في الحاسبة.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن دولة أو عملة…"
              className="field py-2.5 pr-9 pl-3 text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter("ALL")}
              className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === "ALL"
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-border bg-surface text-muted hover:text-ink"
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilter("FAV")}
              className={`inline-flex items-center gap-1 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                filter === "FAV"
                  ? "border-brand-navy bg-brand-navy text-white"
                  : "border-border bg-surface text-muted hover:text-ink"
              }`}
            >
              <Star size={12} className="text-brand-gold" fill="currentColor" /> المفضلة
            </button>
            {currencies.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  filter === c
                    ? "border-brand-navy bg-brand-navy text-white"
                    : "border-border bg-surface text-muted hover:text-ink"
                }`}
                dir="ltr"
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="card mt-6 overflow-hidden overflow-x-auto p-0">
          <table className="w-full min-w-[560px] border-collapse text-right font-mono text-sm">
            <thead>
              <tr className="bg-brand-navy text-xs text-white">
                <th className="px-5 py-3.5 font-medium">من</th>
                <th className="px-5 py-3.5 font-medium">إلى</th>
                <th className="px-5 py-3.5 font-medium">السعر</th>
                <th className="px-5 py-3.5 font-medium">آخر تحديث</th>
                <th className="w-20 px-3 py-3.5" aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const from = CURRENCIES[r.from];
                const to = CURRENCIES[r.to];
                const off = disabledFlows.includes(`${r.from}_${r.to}`);
                return (
                  <tr
                    key={`${r.from}-${r.to}`}
                    onClick={() => openInCalculator(r.from, r.to)}
                    title="احسب في الحاسبة"
                    className={`group cursor-pointer border-t border-border/50 transition-colors hover:bg-primary/5 ${
                      i % 2 === 0 ? "" : "bg-surface2/40"
                    } ${off ? "opacity-60" : ""}`}
                  >
                    <td className="px-5 py-3.5 text-ink" dir="ltr">
                      {from.flag} {r.from}
                    </td>
                    <td className="px-5 py-3.5 text-ink" dir="ltr">
                      {to.flag} {r.to}
                    </td>
                    <td className="px-5 py-3.5 text-base font-bold text-ink" dir="ltr">
                      {off ? (
                        <span className="rounded-full bg-red-500/10 px-2.5 py-1 font-body text-xs font-semibold text-red-500">
                          غير متاح حالياً
                        </span>
                      ) : (
                        formatRate(r.rate)
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-subtle" dir="ltr">{formatUpdated(r.updatedAt)}</td>
                    <td className="px-3 py-2 text-subtle transition-colors group-hover:text-primary">
                      <span className="flex items-center justify-end gap-1">
                        <FavoriteStar from={r.from} to={r.to} />
                        <ChevronLeft size={16} />
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted">
                    {filter === "FAV" && !query
                      ? "لسه ما أضفت مسارات للمفضلة — اضغط على النجمة جنب أي سعر."
                      : `لا توجد نتائج مطابقة لـ «${query}».`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
