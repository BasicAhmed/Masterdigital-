"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CURRENCIES, CUSTOM_CURRENCIES, type CustomCurrency } from "@/lib/corridors";
import { formatSmart } from "@/lib/format";

/** Section ٣ of the rates page: the owner adds a currency (e.g. the Ethiopian
 *  birr). It gets pairs with every other currency, a price from Binance P2P
 *  (or the price he types), and shows up on the site, in transactions,
 *  liquidity and finance. A currency can't be removed once added — old
 *  transactions point at it — but its routes can be switched off in ٢. */
export default function CurrenciesPanel({ onAdd }: { onAdd: (c: CustomCurrency) => Promise<string | null> }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("");
  const [flag, setFlag] = useState("");
  const [perUsd, setPerUsd] = useState("");
  const [decimals, setDecimals] = useState(0);
  const [binance, setBinance] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const c = code.trim().toUpperCase();
  const p = parseFloat(perUsd) || 0;
  const problem = !c
    ? ""
    : !/^[A-Z]{2,6}$/.test(c)
    ? "الرمز من 2 لـ 6 حروف إنجليزية، مثلاً ETB"
    : CURRENCIES[c]
    ? "العملة دي موجودة"
    : "";
  const ready = c && !problem && country.trim() && currency.trim() && p > 0;

  const reset = () => {
    setCode(""); setCountry(""); setCurrency(""); setFlag(""); setPerUsd(""); setDecimals(0); setBinance(true); setErr("");
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="font-display text-base font-bold text-ink">٣ · العملات</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            ضيف عملة جديدة (مثلاً البر الإثيوبي) — بتتربط مع كل العملات وتظهر في الموقع والمعاملات والسيولة.
          </p>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} className="btn-ghost px-4 py-2.5 text-xs">
            <Plus size={14} /> إضافة عملة
          </button>
        )}
      </div>

      {CUSTOM_CURRENCIES.length > 0 && (
        <ul className="flex flex-wrap gap-2 border-t border-border/60 px-5 py-3">
          {CUSTOM_CURRENCIES.map((k) => (
            <li key={k.code} className="rounded-full border border-border bg-surface px-3 py-1 text-xs">
              <span className="me-1">{k.flag || "💱"}</span>
              <b className="num text-ink">{k.code}</b> <span className="text-muted">{k.currency}</span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="space-y-3 border-t border-border/60 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="label">الرمز (بالإنجليزي)</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ETB" dir="ltr" maxLength={6} className="field px-3 py-2.5 font-mono text-sm" />
            </label>
            <label>
              <span className="label">العلم (إيموجي، اختياري)</span>
              <input value={flag} onChange={(e) => setFlag(e.target.value)} placeholder="🇪🇹" maxLength={8} className="field px-3 py-2.5 text-sm" />
            </label>
            <label>
              <span className="label">اسم العملة</span>
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="البر الإثيوبي" className="field px-3 py-2.5 text-sm" />
            </label>
            <label>
              <span className="label">الدولة</span>
              <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="إثيوبيا" className="field px-3 py-2.5 text-sm" />
            </label>
            <label>
              <span className="label">كم {c || "وحدة"} = 1 USDT تقريباً؟</span>
              <input value={perUsd} onChange={(e) => setPerUsd(e.target.value.replace(/[^\d.]/g, ""))} placeholder="155" inputMode="decimal" dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
            </label>
            <label>
              <span className="label">الكسور</span>
              <select value={decimals} onChange={(e) => setDecimals(Number(e.target.value))} className="field px-3 py-2.5 text-sm">
                <option value={0}>أرقام صحيحة (1,500)</option>
                <option value={2}>بقرشين (15.75)</option>
              </select>
            </label>
          </div>
          <label className="flex cursor-pointer items-start gap-2.5 text-xs">
            <input type="checkbox" checked={binance} onChange={(e) => setBinance(e.target.checked)} className="mt-0.5 size-4" />
            <span>
              <b className="text-ink">جيب السعر من Binance P2P</b>
              <span className="block text-muted">لو Binance ما فيه العملة دي، السعر اللي كتبته فوق بيتسجّل يدوي وتقدر تعدّله في القسم ١.</span>
            </span>
          </label>
          <p className="text-[11px] text-subtle">
            الرمز والسعر التقريبي ما بيتغيّروا بعد الإضافة (بيحددوا ترتيب الأزواج).{p > 0 && c ? ` مثلاً: 1 USDT ≈ ${formatSmart(p)} ${c}.` : ""}
          </p>
          {(problem || err) && <p className="text-xs font-semibold text-red-500">{problem || err}</p>}
          <div className="flex gap-2">
            <button
              disabled={!ready || saving}
              onClick={async () => {
                setSaving(true);
                setErr("");
                const e = await onAdd({ code: c, country: country.trim(), currency: currency.trim(), flag: flag.trim(), perUsd: p, decimals, binance, createdAt: new Date().toISOString() });
                setSaving(false);
                if (e) setErr(e);
                else {
                  reset();
                  setOpen(false);
                }
              }}
              className="btn-primary flex-1 py-3 text-sm"
            >
              {saving ? "جارٍ الإضافة وجلب السعر…" : `إضافة ${c || "العملة"}`}
            </button>
            <button onClick={() => { reset(); setOpen(false); }} className="btn-ghost px-5 py-3 text-sm">
              إلغاء
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

