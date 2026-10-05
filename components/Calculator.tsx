"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Ban, Check, ChevronDown } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import { CURRENCIES, CURRENCY_LIST, destinationsFor, findPair, routeKey, type CurrencyCode } from "@/lib/currencies";
import { perUnit } from "@/lib/calc";
import { cleanNumber, fmt, fmtMoney, fmtRate, formatTyping } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { buildAvailabilityMessage, buildOrderMessage } from "@/lib/whatsapp";
import type { Route } from "@/lib/routes";
import { useContact } from "./ContactContext";

type Mode = "send" | "receive";

const QUICK: Record<CurrencyCode, number[]> = {
  SDG: [100000, 500000, 1000000],
  EGP: [1000, 5000, 10000],
  UGX: [100000, 500000, 1000000],
  RWF: [50000, 100000, 500000],
  KES: [5000, 10000, 50000],
  USDT: [100, 500, 1000],
};

/** Other sections fire this to preselect a route and jump to the calculator. */
export const SELECT_PAIR_EVENT = "master:select-pair";
export type SelectPairDetail = { from?: CurrencyCode; to?: CurrencyCode };

export default function Calculator({ routes }: { routes: Route[] }) {
  const { wa } = useContact();
  const [mode, setMode] = useState<Mode>("send");
  const [fromCode, setFromCode] = useState<CurrencyCode>("SDG");
  const [toCode, setToCode] = useState<CurrencyCode>("UGX");
  const [amount, setAmount] = useState("100000");
  const [swaps, setSwaps] = useState(0);

  const toOptions = useMemo(() => destinationsFor(fromCode), [fromCode]);
  const to = toOptions.includes(toCode) ? toCode : toOptions[0];
  const route = routes.find((r) => r.id === routeKey(fromCode, to));
  const pair = findPair(fromCode, to)!;
  const from = CURRENCIES[fromCode];
  const toCur = CURRENCIES[to];
  const unavailable = !route || !route.active;

  useEffect(() => {
    const onSelect = (e: Event) => {
      const d = (e as CustomEvent<SelectPairDetail>).detail ?? {};
      if (d.from) {
        setFromCode(d.from);
        const opts = destinationsFor(d.from);
        setToCode(d.to && opts.includes(d.to) ? d.to : opts[0]);
        setMode("send");
        setAmount(String(QUICK[d.from][0]));
      }
      document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener(SELECT_PAIR_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_PAIR_EVENT, onSelect);
  }, []);

  const n = parseFloat(amount) || 0;
  const r = route ? perUnit(fromCode, to, route.rate) : 0;
  const sent = mode === "send" ? n : r ? n / r : 0;
  const received = mode === "receive" ? n : n * r;
  const active = mode === "send" ? from : toCur;
  const rateLine = route ? `${fmt(pair.unit)} ${pair.base} = ${fmtRate(route.rate)} ${pair.quote}` : "";

  function swap() {
    setFromCode(to);
    setToCode(fromCode);
    setSwaps((x) => x + 1);
  }

  function order() {
    if (unavailable) {
      window.open(wa(buildAvailabilityMessage(from.name, toCur.name)), "_blank", "noopener,noreferrer");
      return;
    }
    window.open(
      wa(
        buildOrderMessage({
          amountSent: fmtMoney(sent, fromCode),
          fromCode,
          fromName: from.name,
          amountReceived: fmtMoney(received, to),
          toCode: to,
          toName: toCur.name,
          rateLine,
        })
      ),
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <section id="calculator" className="relative border-t border-border/60 py-16 sm:py-24">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.15fr] lg:items-center">
          <div>
            <p className="eyebrow">الحاسبة</p>
            <h2 className="section-heading mt-3">احسب تحويلك قبل ما تطلب</h2>
            <p className="mt-3 max-w-md text-muted">اختار العملتين والمبلغ، وشوف المستلم حيستلم كم بسعر اليوم.</p>
            <ul className="mt-6 hidden space-y-3 lg:block">
              {["سعر مختلف لكل اتجاه — زي جدول الأسعار بالضبط", "رسوم التحويل إن وُجدت تتوضح ليك قبل التنفيذ", "الطلب يفتح على واتساب وتفاصيلك جاهزة"].map((t) => (
                <li key={t} className="flex items-center gap-3 text-sm text-ink">
                  <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-primary shadow-soft">
                    <Check size={13} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div aria-hidden="true" className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-brand-gradient opacity-15 blur-3xl" />
            <div className="card relative overflow-hidden p-4 shadow-lift sm:p-6">
              <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />

              <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-surface2 p-1 shadow-well">
                {(
                  [
                    ["send", "عندي مبلغ أرسله"],
                    ["receive", "عاوز يوصل مبلغ"],
                  ] as const
                ).map(([value, text]) => (
                  <button key={value} onClick={() => setMode(value)} className="relative rounded-xl py-2.5 text-sm font-semibold">
                    {mode === value && (
                      <motion.span
                        layoutId="mode-pill"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-primary shadow-glow"
                      />
                    )}
                    <span className={`relative ${mode === value ? "text-bg" : "text-muted"}`}>{text}</span>
                  </button>
                ))}
              </div>

              <div className="relative grid grid-cols-2 gap-2.5">
                {(
                  [
                    ["من", from, fromCode, CURRENCY_LIST.map((c) => c.code), (v: CurrencyCode) => { setFromCode(v); setToCode(destinationsFor(v)[0]); }],
                    ["إلى", toCur, to, toOptions, (v: CurrencyCode) => setToCode(v)],
                  ] as const
                ).map(([label, cur, value, options, onChange]) => (
                  <label
                    key={label}
                    className="relative block rounded-2xl border border-border/70 bg-surface2 p-3 shadow-well transition-colors focus-within:border-primary"
                  >
                    <span className="block text-[11px] font-medium text-subtle">{label}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="text-2xl leading-none">{cur.flag}</span>
                      <span className="min-w-0">
                        <span className="block font-mono text-base font-bold text-ink">{cur.code}</span>
                        <span className="block truncate text-[11px] text-muted">{cur.name}</span>
                      </span>
                      <ChevronDown size={14} className="mr-auto shrink-0 text-subtle" />
                    </span>
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value as CurrencyCode)}
                      aria-label={`${label} عملة`}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    >
                      {options.map((c) => (
                        <option key={c} value={c}>
                          {CURRENCIES[c].name} ({c})
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
                <motion.button
                  onClick={swap}
                  animate={{ rotate: swaps * 180 }}
                  whileTap={{ scale: 0.85 }}
                  aria-label="بدّل العملتين"
                  className="absolute left-1/2 top-1/2 z-10 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-surface bg-primary text-bg shadow-glow"
                >
                  <ArrowLeftRight size={15} />
                </motion.button>
              </div>

              <label className="mt-4 block">
                <span className="label">
                  {mode === "send" ? `المبلغ اللي حترسله (${fromCode})` : `المبلغ اللي عاوزه يوصل (${to})`}
                </span>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={formatTyping(amount)}
                    onChange={(e) => setAmount(cleanNumber(e.target.value, 2))}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="المبلغ"
                    dir="ltr"
                    className="field py-3.5 pl-4 pr-20 text-left font-mono text-2xl font-bold"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-mono text-sm font-semibold text-subtle">
                    {active.code}
                  </span>
                </div>
              </label>

              <div className="mt-2.5 grid grid-cols-3 gap-2" dir="ltr">
                {QUICK[active.code].map((q) => (
                  <button
                    key={q}
                    onClick={() => setAmount(String(q))}
                    className={`rounded-xl border py-1.5 font-mono text-xs font-semibold shadow-soft transition-all ${
                      n === q ? "border-primary bg-primary/10 text-primary" : "border-border/70 bg-surface text-muted hover:border-primary/60 hover:text-primary"
                    }`}
                  >
                    {fmt(q)}
                  </button>
                ))}
              </div>

              {unavailable && (
                <div role="status" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-ink">
                  <span className="mt-0.5 rounded-full bg-red-500/15 p-1.5 text-red-500">
                    <Ban size={14} />
                  </span>
                  <div>
                    <p className="font-semibold">
                      التحويل من {from.name} إلى {toCur.name} غير متاح حالياً
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">راسلنا عشان نبلغك أول ما يتوفر.</p>
                  </div>
                </div>
              )}

              <div className={`relative mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 p-5 text-center shadow-well ${unavailable ? "opacity-50" : ""}`}>
                <p className="text-xs font-medium text-muted">{mode === "send" ? "المستلم يستلم" : "حترسل"}</p>
                <p className="mt-1 font-mono text-[clamp(1.6rem,7vw,2.5rem)] font-bold leading-tight text-ink" dir="ltr">
                  {fmtMoney(mode === "send" ? received : sent, mode === "send" ? to : fromCode)}{" "}
                  <span className="text-base text-primary">{mode === "send" ? to : fromCode}</span>
                </p>
                {route && (
                  <p className="mt-2 text-xs text-muted">
                    السعر:{" "}
                    <span className="font-mono font-semibold text-ink" dir="ltr">
                      {rateLine}
                    </span>
                    {route.updatedAt && <span className="text-subtle"> · {formatRelativeTime(route.updatedAt)}</span>}
                  </p>
                )}
              </div>

              <button onClick={order} disabled={!n} className="btn-whatsapp mt-4 w-full py-4 text-base">
                <WhatsAppIcon size={20} /> {unavailable ? "اسأل عن التوفر" : "اطلب الآن عبر واتساب"}
              </button>
              <p className="mt-3 text-center text-[11px] text-subtle">يتم خصم رسوم التحويل إن وُجدت من المبلغ المستلم.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
