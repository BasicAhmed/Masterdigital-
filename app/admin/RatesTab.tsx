"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Power, RefreshCw } from "lucide-react";
import {
  setRouteMargin,
  computeRate,
  getUsdtPrices,
  resetUsdtPrice,
  setUsdtPriceManual,
  updateRatesFromLiveFx,
  type PairUpdate,
  type RateRow,
} from "@/lib/rates";
import type { UsdtPrices } from "@/lib/fx";
import UsdtPricesPanel from "./UsdtPricesPanel";
import { logActivity } from "@/lib/activity";
import { formatSmart as fs } from "@/lib/format";
import { formatSmart } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { flowKey, setDisabledFlows, setMarginPercent } from "@/lib/settings";
import { PAIRS, CURRENCIES, CURRENCY_ORDER, type CurrencyCode } from "@/lib/corridors";
import { demoMode } from "@/lib/store";

/** The rates screen: one USDT price per currency (from Binance P2P, editable
 *  by hand) that every pair is built from, "update now", the global margin,
 *  and per-DIRECTION margins and on/off switches, so USDT → SDG and
 *  SDG → USDT each earn their own percentage. */


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
  const [savingPrice, setSavingPrice] = useState<CurrencyCode | null>(null);
  const [routeFilter, setRouteFilter] = useState<CurrencyCode | "ALL">("ALL");

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
      logActivity({ kind: "rates", action: "update", refId: key, summary: `${next.includes(key) ? "إيقاف" : "تشغيل"} المسار ${from} → ${to}` });
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
        logActivity({ kind: "rates", action: "update", refId: key, summary: `هامش ${x} → ${y}: ${override === null ? `الهامش العام (${margin}%)` : `${override}%`}` });
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
      logActivity({ kind: "rates", action: "update", summary: `الهامش العام: ${val}%` });
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
      logActivity({ kind: "rates", action: "update", summary: `تحديث الأسعار من Binance (${updated.length} زوج)` });
      applyPairs(updated);
      setPrices(next);
      setFxMessage(`✅ تم تحديث ${updated.length} زوج${problems.length ? ` — ملاحظات: ${problems.join(" · ")}` : ""}`);
    } catch (err) {
      setFxMessage(`❌ ${err instanceof Error ? err.message : String(err)}`);
    }
    setFxUpdating(false);
  }

  async function savePrice(code: CurrencyCode, buy: number, sell: number): Promise<boolean> {
    setSavingPrice(code);
    onError(null);
    try {
      const { updated, prices: next } = await setUsdtPriceManual(code, buy, sell);
      logActivity({ kind: "rates", action: "update", refId: code, summary: `سعر ${code} يدوي: شراء ${fs(buy)} · بيع ${fs(sell)}` });
      applyPairs(updated);
      setPrices(next);
      setSavingPrice(null);
      return true;
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
      setSavingPrice(null);
      return false;
    }
  }

  async function resetPrice(code: CurrencyCode) {
    setSavingPrice(code);
    onError(null);
    try {
      const { updated, prices: next } = await resetUsdtPrice(code);
      logActivity({ kind: "rates", action: "update", refId: code, summary: `سعر ${code}: رجوع للسعر التلقائي` });
      applyPairs(updated);
      setPrices(next);
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
            <label className="mb-1.5 block text-xs font-medium text-subtle">الهامش العام (لكل المسارات اللي ما عندها هامش خاص)</label>
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

      {/* 1 — one USDT price per currency; every pair is built from these */}
      <UsdtPricesPanel prices={prices} busy={savingPrice} onSave={savePrice} onReset={resetPrice} />

      <div className="px-1 pt-2">
        <p className="font-display text-base font-bold text-ink">٢ · المسارات والهوامش</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          سعر العميل = السعر المعتمد ± الهامش. لكل اتجاه هامش خاص وزر تشغيل/إيقاف. اختار عملة عشان تشوف مساراتها بس.
        </p>
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

      {/* Pair cards, filtered by currency so the list stays short */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="فلترة المسارات بالعملة">
        {(["ALL", ...CURRENCY_ORDER] as const).map((c) => (
          <button
            key={c}
            onClick={() => setRouteFilter(c)}
            aria-pressed={routeFilter === c}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              routeFilter === c ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"
            }`}
            dir="ltr"
          >
            {c === "ALL" ? "الكل" : `${CURRENCIES[c].flag} ${c}`}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PAIRS.filter(({ a, b }) => routeFilter === "ALL" || a === routeFilter || b === routeFilter).map(({ a, b }) => {
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
                المعتمد: 1 {b} = <span className="font-mono font-semibold text-muted">{formatSmart(row.marketPrice)}</span> {a}
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
