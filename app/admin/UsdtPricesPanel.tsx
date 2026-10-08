"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Pencil, RotateCcw, X } from "lucide-react";
import { CURRENCIES, CURRENCY_ORDER, USD_PEGGED, type CurrencyCode } from "@/lib/corridors";
import { SKIP_ADS, SOURCE_LABEL, USE_ADS, midOf, type PriceSource, type UsdtPrice, type UsdtPrices } from "@/lib/fx";
import { formatSmart } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";

const SOURCE_TONE: Record<PriceSource, string> = {
  binance: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  manual: "bg-primary/15 text-primary",
  fx: "bg-red-500/10 text-red-500",
  peg: "bg-surface2 text-muted",
};

/** USDT is the base (always 1), so it isn't listed. */
const LISTED = CURRENCY_ORDER.filter((c) => c !== "USDT");

function Box({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2 ${strong ? "bg-primary/10 ring-1 ring-inset ring-primary/25" : "bg-surface2"}`}>
      <p className={`text-[10px] font-semibold ${strong ? "text-primary" : "text-subtle"}`}>{label}</p>
      <div className={`mt-0.5 font-mono text-sm font-bold ${strong ? "text-primary" : "text-ink"}`} dir="ltr">
        {value}
      </div>
    </div>
  );
}

function PriceInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <input
      type="number"
      step="any"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={label}
      className="field w-full px-2 py-1 font-mono text-sm font-bold"
      dir="ltr"
    />
  );
}

function Row({
  code,
  p,
  busy,
  onSave,
  onReset,
}: {
  code: CurrencyCode;
  p: UsdtPrice | undefined;
  busy: boolean;
  onSave: (buy: number, sell: number) => Promise<boolean>;
  onReset: () => void;
}) {
  const c = CURRENCIES[code];
  const [editing, setEditing] = useState(false);
  const [buy, setBuy] = useState("");
  const [sell, setSell] = useState("");
  const [showAds, setShowAds] = useState(false);

  const b = parseFloat(buy);
  const s = parseFloat(sell);
  const valid = b > 0 && s > 0;
  const pegged = USD_PEGGED.includes(code);
  const hasBinance = p?.binanceBuy != null && p?.binanceSell != null;
  const hasAds = !!p && (p.buyAds.length > 0 || p.sellAds.length > 0);

  function startEdit() {
    setBuy(p ? String(+p.buy.toPrecision(8)) : "");
    setSell(p ? String(+p.sell.toPrecision(8)) : "");
    setEditing(true);
  }

  async function save() {
    if (!valid) return;
    if (await onSave(b, s)) setEditing(false);
  }

  return (
    <li className="p-4">
      {/* Currency + where the price comes from */}
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="text-lg">{c.flag}</span>
          <span className="font-mono" dir="ltr">
            {code}
          </span>
          <span className="text-xs font-normal text-muted">{c.name}</span>
        </p>
        {p ? (
          <span className={`chip ${SOURCE_TONE[p.source]}`}>{SOURCE_LABEL[p.source]}</span>
        ) : (
          <span className="chip bg-surface2 text-subtle">ما في سعر لسه</span>
        )}
      </div>

      {/* Buy · Sell · Price used */}
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {editing ? (
          <>
            <Box label="شراء" value={<PriceInput value={buy} onChange={setBuy} label={`سعر شراء USDT بالـ ${code}`} />} />
            <Box label="بيع" value={<PriceInput value={sell} onChange={setSell} label={`سعر بيع USDT بالـ ${code}`} />} />
            <Box label="المعتمد (المتوسط)" value={valid ? formatSmart(midOf(b, s)) : "—"} strong />
          </>
        ) : (
          <>
            <Box label="شراء" value={p ? formatSmart(p.buy) : "—"} />
            <Box label="بيع" value={p ? formatSmart(p.sell) : "—"} />
            <Box label="المعتمد (المتوسط)" value={p ? formatSmart(p.used) : "—"} strong />
          </>
        )}
      </div>

      {editing ? (
        <div className="mt-2.5">
          <p className="text-[11px] leading-relaxed text-muted">
            {pegged
              ? "السعر ده بيفضل ثابت لحد ما تغيره أو ترجعه 1:1."
              : "السعر اليدوي بيفضل ثابت — التحديث ما بيغيره — لحد ما تضغط «رجوع لسعر Binance»."}
          </p>
          <div className="mt-2 flex gap-2">
            <button onClick={save} disabled={!valid || busy} className="btn-primary flex-1 py-2.5 text-xs">
              <Check size={14} /> {busy ? "جارٍ الحفظ…" : "حفظ"}
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost px-4 py-2.5 text-xs">
              <X size={14} /> إلغاء
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* A typed price: show what Binance says now, and the way back */}
          {p?.source === "manual" && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px]">
              <span className="text-muted">
                {hasBinance ? (
                  <>
                    Binance الآن: شراء <b className="font-mono text-ink" dir="ltr">{formatSmart(p.binanceBuy!)}</b> · بيع{" "}
                    <b className="font-mono text-ink" dir="ltr">{formatSmart(p.binanceSell!)}</b>
                  </>
                ) : pegged ? (
                  "سعر يدوي بدل 1:1"
                ) : (
                  "سعر يدوي — ما في قراءة من Binance لسه"
                )}
              </span>
              {(hasBinance || pegged) && (
                <button onClick={onReset} disabled={busy} className="inline-flex items-center gap-1 font-semibold text-primary">
                  <RotateCcw size={12} /> {pegged ? "رجوع لـ 1:1" : "رجوع لسعر Binance"}
                </button>
              )}
            </div>
          )}

          <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
            <span className="text-subtle">{p ? `آخر تغيير ${formatRelativeTime(p.at)}` : ""}</span>
            <div className="flex items-center gap-3">
              {hasAds && (
                <button onClick={() => setShowAds(!showAds)} className="inline-flex items-center gap-1 font-semibold text-muted">
                  إعلانات Binance <ChevronDown size={12} className={showAds ? "rotate-180" : ""} />
                </button>
              )}
              <button onClick={startEdit} className="inline-flex items-center gap-1 font-semibold text-primary">
                <Pencil size={12} /> تعديل
              </button>
            </div>
          </div>

          {showAds && hasAds && (
            <div className="mt-2 rounded-xl bg-surface2 p-3 text-[11px]">
              <p className="mb-2 text-subtle">
                تخطينا أول {SKIP_ADS} إعلانات وأخدنا متوسط الـ {USE_ADS} اللي بعدها
                {p?.binanceAt ? ` · ${formatRelativeTime(p.binanceAt)}` : ""}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["شراء", p!.buyAds, p!.binanceBuy],
                    ["بيع", p!.sellAds, p!.binanceSell],
                  ] as const
                ).map(([label, ads, avg]) => (
                  <div key={label}>
                    <p className="mb-1 font-semibold text-muted">
                      {label}
                      {avg != null && (
                        <span className="font-mono text-ink" dir="ltr">
                          {" "}
                          = {formatSmart(avg)}
                        </span>
                      )}
                    </p>
                    {ads.length ? (
                      <ol className="space-y-0.5 font-mono text-ink" dir="ltr">
                        {ads.map((v: number, i: number) => (
                          <li key={i}>
                            <span className="text-subtle">#{i + SKIP_ADS + 1}</span> {formatSmart(v)}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-subtle">—</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </li>
  );
}

export default function UsdtPricesPanel({
  prices,
  busy,
  onSave,
  onReset,
}: {
  prices: UsdtPrices;
  busy: CurrencyCode | null;
  onSave: (code: CurrencyCode, buy: number, sell: number) => Promise<boolean>;
  onReset: (code: CurrencyCode) => void;
}) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-border/60 p-5">
        <p className="font-display text-base font-bold text-ink">١ · سعر الـ USDT لكل عملة</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          كم وحدة من العملة تساوي 1 USDT. الشراء والبيع بيجوا من Binance تلقائياً، وتقدر تعدّلهم بنفسك.{" "}
          <b className="text-ink">المعتمد = متوسط الشراء والبيع</b>، ومنه بتتحسب أسعار كل المسارات.
        </p>
      </div>
      <ul className="divide-y divide-border/50">
        {LISTED.map((code) => (
          <Row
            key={code}
            code={code}
            p={prices[code]}
            busy={busy === code}
            onSave={(buy, sell) => onSave(code, buy, sell)}
            onReset={() => onReset(code)}
          />
        ))}
      </ul>
    </div>
  );
}
