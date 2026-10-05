"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, RefreshCw } from "lucide-react";
import { CURRENCIES, PAIRS, routeKey, type CurrencyCode } from "@/lib/currencies";
import { marginOf, rateFromMargin, roundRate } from "@/lib/calc";
import { refreshCostsFromMarket, routeMargin, saveRoute, usdRatesFromRoutes, type Route } from "@/lib/routes";
import { fmt, fmtRate } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import type { AdminData } from "./AdminApp";
import { NumInput, Panel } from "./ui";

interface Draft {
  cost: string;
  margin: string;
  rate: string;
  active: boolean;
}

const toDraft = (r: Route): Draft => ({
  cost: String(r.cost),
  margin: String(Math.round(routeMargin(r) * 100) / 100),
  rate: String(r.rate),
  active: r.active,
});
const n = (s: string) => parseFloat(s) || 0;

export default function RatesTab({ data }: { data: AdminData }) {
  const { routes } = data;
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [fxBusy, setFxBusy] = useState(false);
  const [fxMsg, setFxMsg] = useState<string | null>(null);
  const [confirmFx, setConfirmFx] = useState(false);

  const usd = useMemo(() => usdRatesFromRoutes(routes), [routes]);
  const byId = (id: string) => routes.find((r) => r.id === id)!;
  const draftOf = (id: string) => drafts[id] ?? toDraft(byId(id));
  const lastUpdated = routes.map((r) => r.updatedAt).filter((d): d is string => !!d).sort().pop();

  function edit(id: string, field: "cost" | "margin" | "rate", value: string) {
    const r = byId(id);
    const d = { ...draftOf(id), [field]: value };
    if (field === "rate") {
      d.margin = String(Math.round(marginOf(r.from, r.to, n(d.cost), n(value)) * 100) / 100);
    } else {
      // cost or margin changed → the customer rate follows, keeping this direction's margin
      d.rate = String(roundRate(rateFromMargin(r.from, r.to, n(d.cost), n(d.margin))));
    }
    setDrafts((p) => ({ ...p, [id]: d }));
  }

  async function savePair(ids: string[]) {
    const key = ids.join("|");
    setSaving(key);
    try {
      const next = [...routes];
      for (const id of ids) {
        const d = drafts[id];
        if (!d) continue;
        if (!n(d.cost) || !n(d.rate)) throw new Error("سعر التكلفة وسعر العميل لازم يكونوا أكبر من صفر.");
        const saved = await saveRoute({ ...byId(id), cost: n(d.cost), rate: n(d.rate), active: d.active });
        next[next.findIndex((r) => r.id === id)] = saved;
      }
      data.setRoutes(next);
      setDrafts((p) => {
        const c = { ...p };
        ids.forEach((id) => delete c[id]);
        return c;
      });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch (e) {
      data.onError(e instanceof Error ? e.message : String(e));
    }
    setSaving(null);
  }

  async function toggle(id: string) {
    const r = byId(id);
    try {
      const saved = await saveRoute({ ...r, active: !r.active });
      data.setRoutes(routes.map((x) => (x.id === id ? saved : x)));
      setDrafts((p) => (p[id] ? { ...p, [id]: { ...p[id], active: saved.active } } : p));
    } catch (e) {
      data.onError(e instanceof Error ? e.message : String(e));
    }
  }

  async function refresh() {
    setConfirmFx(false);
    setFxBusy(true);
    setFxMsg(null);
    try {
      const { routes: next, skipped } = await refreshCostsFromMarket(routes);
      data.setRoutes(next);
      setDrafts({});
      setFxMsg(skipped.length ? `✅ تم التحديث — تعذر: ${skipped.join("، ")}` : "✅ تم تحديث تكلفة كل المسارات من سعر السوق");
    } catch (e) {
      setFxMsg(`❌ ${e instanceof Error ? e.message : String(e)}`);
    }
    setFxBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="card-sm overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-br from-primary/15 via-transparent to-accent/10 p-5">
          <div className="max-w-xl">
            <p className="font-display text-base font-bold text-ink">الأسعار والهوامش — لكل اتجاه لوحده</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              كل زوج عملات فيه مسارين مستقلين (مثلاً USDT → SDG غير SDG → USDT). لكل مسار سعر تكلفة، هامش ربح، وسعر
              للعميل. غيّر الهامش والسعر يتحسب، أو اكتب السعر والهامش يتحسب. الأسعار دي هي اللي تظهر في الموقع وتتعبّى
              تلقائياً في المعاملة الجديدة.
            </p>
            <p className="mt-2 text-[11px] text-subtle">آخر تحديث: {lastUpdated ? formatRelativeTime(lastUpdated) : "الأسعار الافتراضية"}</p>
          </div>
          {confirmFx ? (
            <div className="flex items-center gap-2">
              <button onClick={refresh} className="btn-primary px-4 py-2.5 text-xs">تأكيد التحديث</button>
              <button onClick={() => setConfirmFx(false)} className="btn-ghost px-4 py-2.5 text-xs">إلغاء</button>
            </div>
          ) : (
            <button onClick={() => setConfirmFx(true)} disabled={fxBusy} className="btn-ghost px-4 py-2.5 text-xs">
              <RefreshCw size={14} className={fxBusy ? "animate-spin" : ""} /> {fxBusy ? "جارٍ التحديث…" : "تحديث التكلفة من سعر السوق"}
            </button>
          )}
        </div>
        {confirmFx && (
          <p className="border-t border-border/60 px-5 py-2.5 text-xs text-muted">
            حيتم استبدال سعر التكلفة لكل المسارات بسعر السوق الحالي، وسعر العميل يتحسب من جديد بنفس هامش كل مسار.
          </p>
        )}
        {fxMsg && <p className="border-t border-border/60 px-5 py-2.5 text-xs text-muted">{fxMsg}</p>}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {PAIRS.map((p) => {
          const ids = [routeKey(p.base, p.quote), routeKey(p.quote, p.base)];
          const key = ids.join("|");
          const dirty = ids.some((id) => drafts[id]);
          return (
            <div key={key} className="card-sm p-4">
              <div className="flex items-center justify-between gap-2" dir="ltr">
                <span className="flex items-center gap-2 font-mono text-sm font-bold text-ink">
                  <span className="text-lg">{CURRENCIES[p.base].flag}</span> {p.base}
                  <ArrowLeftRight size={13} className="text-subtle" />
                  {p.quote} <span className="text-lg">{CURRENCIES[p.quote].flag}</span>
                </span>
                <span className="text-[11px] text-subtle" dir="rtl">
                  السعر لكل <b className="num text-muted">{fmt(p.unit)}</b> {p.base}
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                {(
                  [
                    [ids[0], p.base, p.quote, "بيع"],
                    [ids[1], p.quote, p.base, "شراء"],
                  ] as [string, CurrencyCode, CurrencyCode, string][]
                ).map(([id, f, t, tag]) => {
                  const d = draftOf(id);
                  const r = byId(id);
                  const neg = n(d.margin) < 0;
                  return (
                    <div key={id} className={`rounded-2xl p-3 shadow-well ${r.active ? "bg-surface2/70" : "bg-red-500/5 ring-1 ring-inset ring-red-500/25"}`}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="flex items-center gap-2 text-xs font-bold text-ink">
                          <span className={`chip ${tag === "بيع" ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"}`}>{tag}</span>
                          <span className="font-mono" dir="ltr">
                            {f} → {t}
                          </span>
                        </p>
                        <button
                          role="switch"
                          aria-checked={r.active}
                          aria-label={`تفعيل ${f} إلى ${t}`}
                          onClick={() => toggle(id)}
                          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${r.active ? "bg-emerald-500" : "bg-border"}`}
                        >
                          <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${r.active ? "left-[1.375rem]" : "left-0.5"}`} />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <label>
                          <span className="mb-1 block text-[10px] font-medium text-subtle">التكلفة</span>
                          <NumInput value={d.cost} onChange={(v) => edit(id, "cost", v)} ariaLabel="سعر التكلفة" />
                        </label>
                        <label>
                          <span className="mb-1 block text-[10px] font-medium text-subtle">الهامش %</span>
                          <div dir="ltr">
                            <input
                              type="number"
                              step="any"
                              inputMode="decimal"
                              value={d.margin}
                              onChange={(e) => edit(id, "margin", e.target.value)}
                              aria-label="هامش الربح"
                              className={`field px-3 py-2.5 font-mono text-sm font-semibold ${neg ? "text-red-500" : ""}`}
                            />
                          </div>
                        </label>
                        <label>
                          <span className="mb-1 block text-[10px] font-medium text-subtle">سعر العميل</span>
                          <NumInput value={d.rate} onChange={(v) => edit(id, "rate", v)} ariaLabel="سعر العميل" className="text-primary" />
                        </label>
                      </div>
                      {neg && <p className="mt-1.5 text-[10px] font-semibold text-red-500">الهامش سالب — المسار ده بيخسر بالسعر ده.</p>}
                    </div>
                  );
                })}
              </div>

              <button onClick={() => savePair(ids)} disabled={!dirty || saving === key} className="btn-primary mt-3 w-full py-2.5 text-xs">
                <Check size={14} /> {saving === key ? "جارٍ الحفظ…" : savedKey === key ? "تم الحفظ" : dirty ? "حفظ التغييرات" : "محفوظ"}
              </button>
            </div>
          );
        })}
      </div>

      <Panel title="قيمة العملات بالدولار (للتقارير)">
        <p className="mb-3 text-xs leading-relaxed text-muted">
          لوحة المالية تحوّل كل الأحجام والأرباح للدولار عشان تتجمع وتتقارن. القيم دي محسوبة تلقائياً من أسعار التكلفة
          فوق (USDT = 1 دولار).
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(["SDG", "EGP", "UGX", "RWF", "KES"] as CurrencyCode[]).map((c) => (
            <div key={c} className="rounded-xl bg-surface2/70 p-3 shadow-well">
              <p className="text-[11px] text-subtle">1 USD =</p>
              <p className="num mt-0.5 text-sm font-bold text-ink" dir="ltr">
                {fmtRate(usd[c] ?? 0)} {c}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
