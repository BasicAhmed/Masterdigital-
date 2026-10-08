"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, ChevronDown, Pencil, Power, RefreshCw } from "lucide-react";
import {
  setRouteMargin,
  computeRate,
  getUsdtPrices,
  setUsdtPriceManual,
  updateRatesFromLiveFx,
  type PairUpdate,
  type RateRow,
} from "@/lib/rates";
import { SKIP_ADS, SOURCE_LABEL, USE_ADS, type PriceSource, type UsdtPrices } from "@/lib/fx";
import { formatSmart } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { flowKey, setDisabledFlows, setMarginPercent } from "@/lib/settings";
import { PAIRS, CURRENCIES, CURRENCY_ORDER, type CurrencyCode } from "@/lib/corridors";
import { demoMode } from "@/lib/store";

/** The rates screen: one USDT price per currency (from Binance P2P, editable
 *  by hand) that every pair is built from, "update now", the global margin,
 *  and per-DIRECTION margins and on/off switches, so USDT → SDG and
 *  SDG → USDT each earn their own percentage. */

const SOURCE_TONE: Record<PriceSource, string> = {
  binance: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  manual: "bg-primary/15 text-primary",
  fx: "bg-red-500/10 text-red-500",
  peg: "bg-surface2 text-muted",
};

function SmallButton({ onClick, busy, children }: { onClick: () => void; busy?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="shrink-0 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-semibold text-ink shadow-soft transition-all hover:-translate-y-px hover:border-primary/60 disabled:opacity-60"
    >
      {busy ? "…" : children}
    </button>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        on ? "bg-emerald-500 shadow-[0_0_12px_-2px_rgba(16,185,129,0.7)]" : "bg-border shadow-well"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className={`absolute top-0.5 size-5 rounded-full bg-white shadow ${on ? "left-[1.375rem]" : "left-0.5"}`}
      />
    </button>
  );
}

export interface RatesState {
  rates: RateRow[];
  setRates: React.Dispatch<React.SetStateAction<RateRow[]>>;
  margin: number;
  setMargin: (m: number) => void;
  disabled: string[];
  setDisabled: (d: string[]) => void;
}

export default function RatesTab({ state, onError }: { state: RatesState; onError: (msg: string | null) => void }) {
  const { rates, setRates, margin, setMargin, disabled, setDisabled } = state;
  const [marginInput, setMarginInput] = useState(String(margin));
  const [savingMargin, setSavingMargin] = useState(false);
  // keyed by direction: "USDT_SDG" and "SDG_USDT" are edited separately
  const [marginInputs, setMarginInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [fxUpdating, setFxUpdating] = useState(false);
  const [fxMessage, setFxMessage] = useState<string | null>(null);
  const [prices, setPrices] = useState<UsdtPrices>({});
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});
  const [savingPrice, setSavingPrice] = useState<CurrencyCode | null>(null);
  const [openAds, setOpenAds] = useState<CurrencyCode | null>(null);

  useEffect(() => {
    getUsdtPrices().then(setPrices);
  }, []);
  const lastUpdated = rates
    .map((r) => r.updatedAt)
    .filter((d): d is string => !!d)
    .sort()
    .pop();
  const totalDirections = PAIRS.length * 2;
  const activeDirections = totalDirections - disabled.length;

  /** Puts freshly written pair prices on screen — no refetch. */
  function applyPairs(updated: PairUpdate[]) {
    const stamp = new Date().toISOString();
    for (const u of updated) patchRatePair(u.from, u.to, { marketPrice: u.marketPrice, updatedAt: stamp });
  }

  /** Applies a market-price change to BOTH directions of a pair — no refetch. */
  function patchRatePair(a: string, b: string, updates: Partial<RateRow>) {
    setRates((prev) =>
      prev.map((r) => {
        if ((r.from === a && r.to === b) || (r.from === b && r.to === a)) {
          const merged = { ...r, ...updates };
          return { ...merged, rate: computeRate(r.from, r.to, merged.marketPrice, merged.marginPercent) };
        }
        return r;
      })
    );
  }

  async function toggleFlow(from: CurrencyCode, to: CurrencyCode) {
    const key = flowKey(from, to);
    const prev = disabled;
    const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
    setDisabled(next); // optimistic
    onError(null);
    try {
      await setDisabledFlows(next);
    } catch (err) {
      setDisabled(prev);
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  /** Saves the margins of a pair's two directions — each one on its own. */
  async function savePair(a: CurrencyCode, b: CurrencyCode) {
    const pairId = `${a}_${b}`;
    setSaving(pairId);
    onError(null);
    try {
      for (const [x, y] of [
        [a, b],
        [b, a],
      ] as const) {
        const key = flowKey(x, y);
        const raw = marginInputs[key];
        if (raw === undefined) continue; // this direction wasn't touched
        const override = raw.trim() === "" ? null : parseFloat(raw);
        if (override !== null && Number.isNaN(override)) continue;
        await setRouteMargin(x, y, override);
        const effective = override ?? margin;
        setRates((prev) =>
          prev.map((r) =>
            r.from === x && r.to === y
              ? {
                  ...r,
                  marginPercent: effective,
                  marginOverride: override ?? undefined,
                  rate: computeRate(x, y, r.marketPrice, effective),
                  updatedAt: new Date().toISOString(),
                }
              : r
          )
        );
        setMarginInputs((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
    setSaving(null);
  }

  async function saveGlobalMargin() {
    setSavingMargin(true);
    onError(null);
    try {
      const val = parseFloat(marginInput);
      await setMarginPercent(val);
      setMargin(val);
      setRates((prev) =>
        prev.map((r) =>
          r.marginOverride == null ? { ...r, marginPercent: val, rate: computeRate(r.from, r.to, r.marketPrice, val) } : r
        )
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
    setSavingMargin(false);
  }

  async function updateNow() {
    setFxUpdating(true);
    setFxMessage(null);
    try {
      const { updated, prices: next, problems } = await updateRatesFromLiveFx();
      applyPairs(updated);
      setPrices(next);
      setPriceInputs({});
      setFxMessage(`✅ تم تحديث ${updated.length} زوج${problems.length ? ` — ملاحظات: ${problems.join(" · ")}` : ""}`);
    } catch (err) {
      setFxMessage(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
    setFxUpdating(false);
  }

  async function savePrice(code: CurrencyCode) {
    const val = parseFloat(priceInputs[code] ?? "");
    if (!(val > 0)) return;
    setSavingPrice(code);
    onError(null);
    try {
      const { updated, prices: next } = await setUsdtPriceManual(code, val);
      applyPairs(updated);
      setPrices(next);
      setPriceInputs((prev) => {
        const n = { ...prev };
        delete n[code];
        return n;
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
    setSavingPrice(null);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {demoMode && (
        <p className="rounded-2xl border border-border/70 bg-surface2 p-3 text-xs leading-relaxed text-muted">
          تعديل الأسعار والهوامش وتحديثها من السوق يحتاج Firebase. قبل تفعيله تقدر تجرّب أي هامش هنا وتشوف السعر الناتج،
          لكن الحفظ ما حيشتغل.
        </p>
      )}

      {/* Controls */}
      <div className="card overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-br from-primary/15 via-transparent to-accent/10 p-5">
          <div>
            <p className="text-xs text-muted">آخر تحديث للأسعار</p>
            <p className="mt-0.5 font-display text-lg font-bold text-ink">
              {lastUpdated ? formatRelativeTime(lastUpdated) : "لم تُحدَّث بعد"}
            </p>
          </div>
          <button onClick={updateNow} disabled={fxUpdating} className="btn-primary px-5 py-3 text-sm">
            <RefreshCw size={15} className={fxUpdating ? "animate-spin" : ""} />
            {fxUpdating ? "جارٍ التحديث…" : "تحديث الآن"}
          </button>
        </div>
        {fxMessage && <p className="border-t border-border/60 px-5 py-2.5 text-xs text-muted">{fxMessage}</p>}

        <div className="border-t border-border/60 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-subtle">الهامش العام</label>
            <div className="flex gap-2" dir="ltr">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  value={marginInput}
                  onChange={(e) => setMarginInput(e.target.value)}
                  className="field py-2.5 pl-3.5 pr-8 font-mono text-sm font-semibold"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-subtle">
                  %
                </span>
              </div>
              <SmallButton onClick={saveGlobalMargin} busy={savingMargin}>
                حفظ
              </SmallButton>
            </div>
          </div>
        </div>
      </div>

      {/* One USDT price per currency — every pair is built from these */}
      <div className="card overflow-hidden p-0">
        <div className="border-b border-border/60 p-5">
          <p className="font-display text-base font-bold text-ink">سعر USDT لكل عملة</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            من Binance P2P: نتخطى أول {SKIP_ADS} إعلانات (المثبتة) ونحسب متوسط الـ {USE_ADS} اللي بعدها، للشراء وللبيع. السعر
            المستخدم = منتصف الاتنين، ومنه بتتحسب كل الأسعار. تقدر تكتب سعر بنفسك لأي عملة.
          </p>
        </div>
        <ul className="divide-y divide-border/50">
          {CURRENCY_ORDER.map((code) => {
            const p = prices[code];
            const c = CURRENCIES[code];
            const typed = priceInputs[code];
            const hasAds = !!p && (p.buyAds.length > 0 || p.sellAds.length > 0);
            return (
              <li key={code} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="text-lg">{c.flag}</span>
                    <span className="font-mono" dir="ltr">{code}</span>
                    <span className="text-xs font-normal text-muted">{c.name}</span>
                  </p>
                  {p ? (
                    <span className={`chip ${SOURCE_TONE[p.source]}`}>{SOURCE_LABEL[p.source]}</span>
                  ) : (
                    <span className="chip bg-surface2 text-subtle">لم يُحدَّث</span>
                  )}
                </div>

                {p && (
                  <>
                    <p className="mt-2 font-mono text-lg font-bold text-primary" dir="ltr">
                      1 USDT = {formatSmart(p.used)} {code}
                    </p>
                    <p className="flex flex-wrap gap-x-3 text-[11px] text-muted">
                      {p.buy != null && (
                        <span>
                          شراء: <b className="font-mono text-ink" dir="ltr">{formatSmart(p.buy)}</b>
                        </span>
                      )}
                      {p.sell != null && (
                        <span>
                          بيع: <b className="font-mono text-ink" dir="ltr">{formatSmart(p.sell)}</b>
                        </span>
                      )}
                      <span>{formatRelativeTime(p.at)}</span>
                    </p>
                    {p.source === "manual" && p.buy != null && (
                      <p className="mt-0.5 text-[11px] text-subtle">
                        سعر يدوي — Binance كان{" "}
                        <span className="font-mono" dir="ltr">
                          {formatSmart(p.sell != null ? (p.buy + p.sell) / 2 : p.buy)}
                        </span>
                      </p>
                    )}
                    {hasAds && (
                      <button
                        onClick={() => setOpenAds(openAds === code ? null : code)}
                        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
                      >
                        الإعلانات المستخدمة
                        <ChevronDown size={12} className={openAds === code ? "rotate-180" : ""} />
                      </button>
                    )}
                    {openAds === code && hasAds && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                        {(
                          [
                            ["شراء", p.buyAds],
                            ["بيع", p.sellAds],
                          ] as const
                        ).map(([label, ads]) => (
                          <div key={label} className="rounded-xl bg-surface2 p-2.5">
                            <p className="mb-1 font-semibold text-muted">{label}</p>
                            {ads.length ? (
                              <ol className="space-y-0.5 font-mono text-ink" dir="ltr">
                                {ads.map((v, i) => (
                                  <li key={i}>
                                    #{i + SKIP_ADS + 1} · {formatSmart(v)}
                                  </li>
                                ))}
                              </ol>
                            ) : (
                              <p className="text-subtle">—</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="mt-2.5 flex gap-2" dir="ltr">
                  <div className="relative flex-1">
                    <Pencil size={12} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
                    <input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      value={typed ?? ""}
                      onChange={(e) => setPriceInputs((prev) => ({ ...prev, [code]: e.target.value }))}
                      placeholder={p ? `سعر يدوي (${formatSmart(p.used)})` : "سعر يدوي"}
                      aria-label={`سعر USDT بالـ ${code}`}
                      className="field py-2 pl-8 pr-3 font-mono text-sm"
                    />
                  </div>
                  <SmallButton onClick={() => savePrice(code)} busy={savingPrice === code}>
                    حفظ
                  </SmallButton>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Active flows summary */}
      <div className="card-sm flex items-center gap-3 p-4">
        <span
          className={`rounded-xl p-2 ${
            disabled.length ? "bg-amber-500/15 text-amber-500" : "bg-emerald-500/15 text-emerald-500"
          }`}
        >
          <Power size={16} />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-ink">
            الاتجاهات المتاحة:{" "}
            <span className="font-mono" dir="ltr">
              {activeDirections}/{totalDirections}
            </span>
          </p>
          <p className="text-[11px] leading-relaxed text-muted">
            اقفل أي اتجاه ما عندك سيولة فيه — يفضل ظاهر في الحاسبة مع ملاحظة «غير متاح حالياً». التغيير يظهر في
            الموقع خلال دقيقة.
          </p>
        </div>
      </div>

      {/* Pair cards */}
      <div className="grid gap-3 sm:grid-cols-2">
        {PAIRS.map(({ a, b }) => {
          const row = rates.find((r) => r.from === a && r.to === b);
          if (!row) return null;
          const fromC = CURRENCIES[a];
          const toC = CURRENCIES[b];
          const pairId = `${a}_${b}`;
          const bothOff = disabled.includes(flowKey(a, b)) && disabled.includes(flowKey(b, a));
          const dirty = marginInputs[flowKey(a, b)] !== undefined || marginInputs[flowKey(b, a)] !== undefined;

          return (
            <div key={pairId} className={`card-sm p-4 transition-opacity ${bothOff ? "opacity-70" : ""}`}>
              <div className="flex items-center justify-between" dir="ltr">
                <div className="flex items-center gap-2.5">
                  <div className="flex -space-x-2">
                    <span className="flex size-8 items-center justify-center rounded-full border-2 border-surface bg-surface2 text-base shadow-soft">
                      {fromC.flag}
                    </span>
                    <span className="flex size-8 items-center justify-center rounded-full border-2 border-surface bg-surface2 text-base shadow-soft">
                      {toC.flag}
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-ink">
                    {a} <ArrowLeftRight size={12} className="text-subtle" /> {b}
                  </span>
                </div>
                <span className="text-[11px] text-subtle">{row.updatedAt ? formatRelativeTime(row.updatedAt) : "—"}</span>
              </div>

              <p className="mt-2 text-[11px] text-subtle" dir="ltr">
                Market: 1 {b} = <span className="font-mono font-semibold text-muted">{formatSmart(row.marketPrice)}</span> {a}
              </p>

              {/* Each direction: rate + on/off + ITS OWN margin */}
              <div className="mt-3 grid grid-cols-2 gap-2" dir="ltr">
                {(
                  [
                    [a, b],
                    [b, a],
                  ] as const
                ).map(([x, y]) => {
                  const dir = rates.find((r) => r.from === x && r.to === y) ?? row;
                  const key = flowKey(x, y);
                  const on = !disabled.includes(key);
                  const typed = marginInputs[key];
                  const value = typed ?? (dir.marginOverride != null ? String(dir.marginOverride) : "");
                  // preview what the customer rate becomes with the margin being typed
                  const previewMargin =
                    typed === undefined ? dir.marginPercent : typed.trim() === "" ? margin : parseFloat(typed) || 0;
                  return (
                    <div
                      key={key}
                      className={`rounded-xl px-3 py-2.5 shadow-well transition-colors ${
                        on ? "bg-surface2" : "bg-red-500/5 ring-1 ring-inset ring-red-500/25"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[10px] font-semibold text-subtle">
                          {x} → {y}
                        </p>
                        <Switch on={on} onChange={() => toggleFlow(x, y)} label={`${x} إلى ${y}`} />
                      </div>
                      <p
                        className={`mt-1 font-mono text-base font-bold ${
                          on ? "text-primary" : "text-subtle line-through decoration-red-500/60"
                        }`}
                      >
                        {formatSmart(computeRate(x, y, dir.marketPrice, previewMargin))}
                      </p>
                      <p className={`text-[10px] font-semibold ${on ? "text-emerald-500" : "text-red-500"}`} dir="rtl">
                        {on ? "متاح" : "متوقف"}
                        {dir.marginOverride != null && <span className="mr-1.5 text-accent">· هامش خاص</span>}
                      </p>
                      <div className="relative mt-2">
                        <input
                          type="number"
                          step="any"
                          inputMode="decimal"
                          value={value}
                          onChange={(e) => setMarginInputs((prev) => ({ ...prev, [key]: e.target.value }))}
                          placeholder={String(margin)}
                          aria-label={`هامش ${x} إلى ${y}`}
                          className="field py-2 pl-3 pr-7 font-mono text-sm"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-subtle">
                          %
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="mb-2 mt-3 text-[11px] text-subtle">
                هامش لكل اتجاه لوحده — اتركه فاضي لاستخدام الهامش العام ({margin}%)
              </p>
              <button onClick={() => savePair(a, b)} disabled={!dirty || saving === pairId} className="btn-primary w-full py-2.5 text-xs">
                {saving === pairId ? "…" : dirty ? "حفظ الهوامش" : "محفوظ"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
