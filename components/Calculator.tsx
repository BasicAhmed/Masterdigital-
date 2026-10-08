"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowLeftRight, Ban, ChevronDown, Share2, Check } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import { FROM_CURRENCIES, validToCurrencies, CURRENCIES, isMultiplyCorridor, type CurrencyCode } from "@/lib/corridors";
import { formatRate } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { createShareCardBlob } from "@/lib/shareCard";
import { convertBetween, type RateRow } from "@/lib/rates";
import { DISCOUNT_THRESHOLD_USDT, DISCOUNT_AMOUNT_USDT } from "@/lib/promotions";
import { getRateHistory, type RateHistoryPoint } from "@/lib/rateHistory";
import { buildAvailabilityMessage, buildOrderMessage } from "@/lib/whatsapp";
import { useContact } from "./ContactContext";
import RateHistoryChart from "./RateHistoryChart";
import CalcExtras from "./CalcExtras";

type Mode = "send" | "receive";

// Convenience tap-to-fill amounts, roughly scaled to how students actually
// send each currency (a few hundred SAR vs hundreds of thousands SDG).
const QUICK_AMOUNTS: Record<CurrencyCode, number[]> = {
  SDG: [100000, 500000, 1000000],
  EGP: [1000, 5000, 10000],
  UGX: [100000, 500000, 1000000],
  RWF: [50000, 100000, 500000],
  KES: [5000, 10000, 50000],
  SAR: [500, 1000, 5000],
  AED: [500, 1000, 5000],
  USDT: [100, 500, 1000],
  USD: [100, 500, 1000],
  USDSS: [100, 500, 1000],
};

/** Custom event other sections fire to preselect a pair and jump to the calculator. */
export const SELECT_PAIR_EVENT = "master:select-pair";
export type SelectPairDetail = { from?: CurrencyCode; to?: CurrencyCode };

/** "100000.5" → "100,000.5" while typing (keeps a trailing dot / decimals as typed). */
function formatTyping(raw: string) {
  if (!raw) return "";
  const [int, dec] = raw.split(".");
  const intFmt = int ? Number(int).toLocaleString("en-US") : "0";
  return dec !== undefined ? `${intFmt}.${dec}` : intFmt;
}

export default function Calculator({ rates, disabledFlows = [] }: { rates: RateRow[]; disabledFlows?: string[] }) {
  const { wa } = useContact();
  const [mode, setMode] = useState<Mode>("send");
  const [fromCode, setFromCode] = useState<CurrencyCode>(FROM_CURRENCIES[0].code);
  const toOptions = useMemo(() => validToCurrencies(fromCode), [fromCode]);
  const [toCode, setToCode] = useState<CurrencyCode>(toOptions[0]?.code);
  const [amount, setAmount] = useState("100000");
  const [swapCount, setSwapCount] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [shared, setShared] = useState(false);
  const [sharing, setSharing] = useState(false);

  const currentToOptions = useMemo(() => validToCurrencies(fromCode), [fromCode]);
  const toCurrency = currentToOptions.find((c) => c.code === toCode) ?? currentToOptions[0];
  const fromCurrency = CURRENCIES[fromCode];

  const rate = rates.find((r) => r.from === fromCode && r.to === toCurrency?.code);

  const involvesSudan = fromCode === "SDG" || toCurrency?.code === "SDG";
  const isOff = (from: CurrencyCode, to: CurrencyCode) => disabledFlows.includes(`${from}_${to}`);
  const unavailable = !!toCurrency && isOff(fromCode, toCurrency.code);

  // Let the hero chips / rates table preselect a pair and scroll here.
  useEffect(() => {
    const onSelect = (e: Event) => {
      const { from, to } = (e as CustomEvent<SelectPairDetail>).detail ?? {};
      if (from) {
        setFromCode(from);
        const options = validToCurrencies(from);
        setToCode(to && options.some((c) => c.code === to) ? to : options[0]?.code);
      }
      document.getElementById("calculator")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener(SELECT_PAIR_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_PAIR_EVENT, onSelect);
  }, []);

  const [history, setHistory] = useState<RateHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  useEffect(() => {
    if (!toCurrency) return;
    let cancelled = false;
    setHistoryLoading(true);
    getRateHistory(fromCode, toCurrency.code, 30).then((points) => {
      if (!cancelled) {
        setHistory(points);
        setHistoryLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fromCode, toCurrency]);

  const amountNum = parseFloat(amount) || 0;

  // Each pair has one market price; whichever side is the "b→a" leg of the
  // pair multiplies instead of dividing (see lib/corridors.ts + lib/rates.ts).
  const usesMultiply = toCurrency ? isMultiplyCorridor(fromCode, toCurrency.code) : false;

  // Compares the last two history points for this pair's market price.
  // Fixed convention regardless of direction: price went up = red (زيادة),
  // price went down = green (انخفاض) — same as the rest of the site's
  // trend colors.
  const trend = useMemo<"up" | "down" | null>(() => {
    if (history.length < 2) return null;
    const prev = history[history.length - 2].marketPrice;
    const latest = history[history.length - 1].marketPrice;
    if (prev === latest) return null;
    return latest > prev ? "up" : "down";
  }, [history]);

  // "send" mode: student knows what they're sending (fromCurrency amount).
  // "receive" mode: student knows what they need the recipient to get (toCurrency amount).
  const amountSent =
    mode === "send"
      ? amountNum
      : rate
      ? usesMultiply
        ? amountNum / rate.rate
        : amountNum * rate.rate
      : 0;
  const amountReceived =
    mode === "receive"
      ? amountNum
      : rate
      ? usesMultiply
        ? amountNum * rate.rate
        : amountNum / rate.rate
      : 0;

  const activeCurrency = mode === "send" ? fromCurrency : toCurrency;
  const quickAmounts = activeCurrency ? QUICK_AMOUNTS[activeCurrency.code] : [];

  // Volume discount: send amount worth ≥1500 USDT gets a flat 15 USDT bonus,
  // added on top of what they'd normally receive.
  const usdtEquivalent = amountSent > 0 ? convertBetween(amountSent, fromCode, "USDT", rates) : null;
  const discountApplies = usdtEquivalent !== null && usdtEquivalent >= DISCOUNT_THRESHOLD_USDT;
  const discountBonus =
    discountApplies && toCurrency ? convertBetween(DISCOUNT_AMOUNT_USDT, "USDT", toCurrency.code, rates) ?? 0 : 0;
  const finalAmountReceived = amountReceived + discountBonus;

  function handleFromChange(code: CurrencyCode) {
    setFromCode(code);
    const next = validToCurrencies(code);
    setToCode(next[0]?.code);
  }

  function swapCurrencies() {
    if (!toCurrency) return;
    const newFrom = toCurrency.code;
    const newTo = fromCode;
    setFromCode(newFrom);
    setToCode(newTo);
    setSwapCount((n) => n + 1);
  }

  function orderNow() {
    if (!toCurrency) return;
    if (unavailable) {
      window.open(
        wa(buildAvailabilityMessage(fromCode, toCurrency.code, fromCurrency.currency, toCurrency.currency)),
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }
    if (!rate) return;
    const message = buildOrderMessage({
      amountReceived: finalAmountReceived.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      toCurrency: toCurrency.code,
      toName: toCurrency.currency,
      amountSent: amountSent.toLocaleString("en-US", { maximumFractionDigits: 2 }),
      fromCurrency: fromCurrency.code,
      fromName: fromCurrency.currency,
      rateLine: rateText,
      discountNote: discountApplies
        ? `مؤهل لخصم ${DISCOUNT_AMOUNT_USDT} USDT (التحويل أكتر من ${DISCOUNT_THRESHOLD_USDT} USDT)`
        : undefined,
    });
    window.open(wa(message), "_blank", "noopener,noreferrer");
  }

  async function shareResult() {
    if (!rate || !toCurrency) return;
    setSharing(true);
    try {
      const rateLine = usesMultiply
        ? `1 ${fromCurrency.code} = ${formatRate(rate.rate)} ${toCurrency.code}`
        : `1 ${toCurrency.code} = ${formatRate(rate.rate)} ${fromCurrency.code}`;
      const trendLabel = trend === "up" ? "▲ زيادة" : trend === "down" ? "▼ انخفاض" : undefined;
      const updatedCaption = rate.updatedAt
        ? `آخر تحديث للسعر: ${formatRelativeTime(rate.updatedAt)}`
        : undefined;

      const blob = await createShareCardBlob({
        fromFlag: fromCurrency.flag,
        fromCode: fromCurrency.code,
        toFlag: toCurrency.flag,
        toCode: toCurrency.code,
        amountSent: amountSent.toLocaleString("en-US", { maximumFractionDigits: 2 }),
        amountReceived: finalAmountReceived.toLocaleString("en-US", { maximumFractionDigits: 2 }),
        rateLine,
        trendLabel,
        // shareCard's "good" slot renders emerald, "bad" renders red — up=red, down=green here.
        trendColor: trend === "up" ? "bad" : trend === "down" ? "good" : "neutral",
        updatedCaption,
        history,
      });

      if (!blob) throw new Error("canvas unsupported");

      const file = new File([blob], "master-digital-quote.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Master Digital" });
        } catch {
          // user cancelled the share sheet — no-op
        }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "master-digital-quote.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setShared(true);
        setTimeout(() => setShared(false), 1800);
      }
    } catch {
      // canvas/share unavailable — fall back to a plain text share/copy
      const text = [
        `Master Digital — ${fromCurrency.code} ⇄ ${toCurrency.code}`,
        `${amountSent.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${fromCurrency.code} = ${finalAmountReceived.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${toCurrency.code}`,
      ].join("\n");
      if (navigator.share) {
        try {
          await navigator.share({ text });
        } catch {
          // user cancelled — no-op
        }
      } else {
        try {
          await navigator.clipboard.writeText(text);
          setShared(true);
          setTimeout(() => setShared(false), 1800);
        } catch {
          // clipboard unavailable — nothing more we can do
        }
      }
    }
    setSharing(false);
  }

  const rateText =
    rate && toCurrency
      ? usesMultiply
        ? `1 ${fromCurrency.code} = ${formatRate(rate.rate)} ${toCurrency.code}`
        : `1 ${toCurrency.code} = ${formatRate(rate.rate)} ${fromCurrency.code}`
      : "";
  const trendTone =
    trend === "up"
      ? { box: "border-red-500/30 bg-red-500/10", dot: "bg-red-500", text: "text-red-500" }
      : trend === "down"
      ? { box: "border-emerald-500/30 bg-emerald-500/10", dot: "bg-emerald-500", text: "text-emerald-500" }
      : { box: "border-primary/25 bg-primary/10", dot: "bg-primary", text: "text-primary" };

  return (
    <div id="calculator" className="relative scroll-mt-24">
            <div className="calc-card relative overflow-hidden p-4 sm:p-6">

              {/* Mode toggle */}
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-surface2 p-1 shadow-well">
                {(
                  [
                    ["send", "عندي مبلغ أرسله"],
                    ["receive", "عاوز يوصل مبلغ"],
                  ] as const
                ).map(([value, text]) => (
                  <button
                    key={value}
                    onClick={() => setMode(value)}
                    className="relative rounded-xl py-2.5 text-sm font-semibold transition-colors"
                  >
                    {mode === value && (
                      <motion.span
                        layoutId="mode-pill"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-brand-navy"
                      />
                    )}
                    <span className={`relative ${mode === value ? "text-white" : "text-muted"}`}>{text}</span>
                  </button>
                ))}
              </div>

              {/* Currency pickers */}
              <div className="relative grid grid-cols-2 gap-2.5">
                {(
                  [
                    ["من", fromCurrency, fromCode, FROM_CURRENCIES, (v: CurrencyCode) => handleFromChange(v)],
                    ["إلى", toCurrency, toCurrency?.code, currentToOptions, (v: CurrencyCode) => setToCode(v)],
                  ] as const
                ).map(([label, cur, value, options, onChange]) => (
                  <label
                    key={label}
                    className="relative block rounded-2xl border border-border/70 bg-surface2 p-3 shadow-well transition-colors focus-within:border-primary"
                  >
                    <span className="block text-[11px] font-medium text-subtle">{label}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <span className="text-2xl leading-none">{cur?.flag}</span>
                      <span className="min-w-0">
                        <span className="block font-mono text-base font-bold text-ink">{cur?.code}</span>
                        <span className="block truncate text-[11px] text-muted">{cur?.name}</span>
                      </span>
                      <ChevronDown size={14} className="mr-auto shrink-0 text-subtle" />
                    </span>
                    <select
                      value={value}
                      onChange={(e) => onChange(e.target.value as CurrencyCode)}
                      aria-label={`${label} عملة`}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    >
                      {options.map((c) => {
                        const off =
                          label === "من"
                            ? validToCurrencies(c.code).every((t) => isOff(c.code, t.code))
                            : isOff(fromCode, c.code);
                        return (
                          <option key={c.code} value={c.code}>
                            {c.name} ({c.code}){off ? " — غير متاح حالياً" : ""}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                ))}

                <motion.button
                  onClick={swapCurrencies}
                  animate={{ rotate: swapCount * 180 }}
                  whileTap={{ scale: 0.85 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  aria-label="بدّل العملتين"
                  title="بدّل العملتين"
                  className="absolute left-1/2 top-1/2 z-10 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-surface bg-brand-navy text-white"
                >
                  <ArrowLeftRight size={15} />
                </motion.button>
              </div>

              {/* Amount */}
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-medium text-subtle">
                  {mode === "send"
                    ? `المبلغ اللي حترسله (${fromCurrency.code})`
                    : `المبلغ اللي عاوزه يوصل (${toCurrency?.code})`}
                </span>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={formatTyping(amount)}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9.]/g, "");
                      const [int, ...rest] = clean.split(".");
                      const next = rest.length ? `${int}.${rest.join("").slice(0, 2)}` : int;
                      setAmount(next.replace(/^0+(?=\d)/, ""));
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label="المبلغ"
                    dir="ltr"
                    className="field py-3.5 pl-4 pr-20 text-left font-mono text-2xl font-bold"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center font-mono text-sm font-semibold text-subtle">
                    {activeCurrency?.code}
                  </span>
                </div>
              </label>

              {quickAmounts.length > 0 && (
                <div className="mt-2.5 grid grid-cols-3 gap-2" dir="ltr">
                  {quickAmounts.map((q) => (
                    <button
                      key={q}
                      onClick={() => setAmount(String(q))}
                      className={`rounded-xl border py-1.5 font-mono text-xs font-semibold transition-all ${
                        amountNum === q
                          ? "border-primary bg-primary/10 text-primary shadow-soft"
                          : "border-border/70 bg-surface text-muted shadow-soft hover:border-primary/60 hover:text-primary"
                      }`}
                    >
                      {q.toLocaleString("en-US")}
                    </button>
                  ))}
                </div>
              )}

              <AnimatePresence initial={false}>
                {unavailable && toCurrency && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div
                      role="status"
                      className="mt-4 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-sm text-ink"
                    >
                      <span className="mt-0.5 rounded-full bg-red-500/15 p-1.5 text-red-500">
                        <Ban size={14} />
                      </span>
                      <div>
                        <p className="font-semibold">
                          التحويل من {fromCurrency.currency} إلى {toCurrency.currency} غير متاح حالياً
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">
                          تقدر تشوف السعر التقريبي، لكن الطلب موقوف مؤقتاً. راسلنا عشان نبلغك أول ما يتوفر.
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Result */}
              <div className={`relative mt-4 overflow-hidden rounded-2xl result-well transition-opacity ${unavailable ? "opacity-60" : ""} p-5 text-center`}>
                <div className="flex items-center justify-center gap-2">
                  <p className="text-xs font-medium text-muted">المستلم يستلم</p>
                  {rate && (
                    <button
                      onClick={shareResult}
                      disabled={sharing}
                      aria-label="مشاركة النتيجة كصورة"
                      title="مشاركة النتيجة كصورة"
                      className="rounded-full p-1 text-subtle transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                    >
                      {sharing ? (
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                          className="block"
                        >
                          <Share2 size={13} />
                        </motion.span>
                      ) : shared ? (
                        <Check size={13} className="text-primary" />
                      ) : (
                        <Share2 size={13} />
                      )}
                    </button>
                  )}
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={`${finalAmountReceived}-${toCurrency?.code}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mt-1 break-all font-mono text-3xl font-extrabold text-ink sm:text-4xl"
                    dir="ltr"
                  >
                    {rate ? (
                      <>
                        {finalAmountReceived.toLocaleString("en-US", { maximumFractionDigits: 2 })}{" "}
                        <span className="text-brand-gold">{toCurrency.code}</span>
                      </>
                    ) : (
                      "اختر ممر التحويل"
                    )}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-1 text-sm text-muted">
                  مقابل{" "}
                  <span className="font-mono" dir="ltr">
                    {amountSent.toLocaleString("en-US", { maximumFractionDigits: 2 })} {fromCurrency.code}
                  </span>
                </p>
                {discountApplies && (
                  <p className="mt-2 inline-block rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-500">
                    🎉 خصم {DISCOUNT_AMOUNT_USDT} USDT مضاف — تحويل أكتر من {DISCOUNT_THRESHOLD_USDT} USDT
                  </p>
                )}

                {rate && toCurrency && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`${fromCode}-${toCurrency.code}-${trend ?? "flat"}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25 }}
                      className={`mx-auto mt-4 flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 ${trendTone.box}`}
                    >
                      <span className="relative flex size-2">
                        <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${trendTone.dot}`} />
                        <span className={`relative inline-flex size-2 rounded-full ${trendTone.dot}`} />
                      </span>
                      <span className={`font-mono text-xs font-bold ${trendTone.text}`} dir="ltr">
                        {rateText}
                      </span>
                      {trend && (
                        <span className={`text-[11px] ${trendTone.text}`}>
                          {trend === "up" ? "▲ زيادة" : "▼ انخفاض"}
                        </span>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
                {rate?.updatedAt && (
                  <p className="mt-1.5 text-[11px] text-subtle">آخر تحديث للسعر: {formatRelativeTime(rate.updatedAt)}</p>
                )}
              </div>

              {involvesSudan && (
                <div
                  className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-ink"
                  role="alert"
                >
                  <span aria-hidden="true">⚠️</span>
                  <p>
                    سعر الجنيه السوداني بيتقلب بشكل كبير الفترة دي — تأكد من السعر مع الإدارة قبل ما تأكد الطلب.
                  </p>
                </div>
              )}

              {toCurrency && (
                <div className="mt-2">
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-medium text-subtle transition-colors hover:text-primary"
                  >
                    {showHistory ? "إخفاء سعر آخر 30 يوم" : "عرض سعر آخر 30 يوم"}
                    <motion.span animate={{ rotate: showHistory ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown size={14} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {showHistory && !historyLoading && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <RateHistoryChart points={history} label={`${fromCurrency.code} ⇄ ${toCurrency.code}`} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              <motion.button
                onClick={orderNow}
                disabled={!unavailable && (!rate || amountNum <= 0)}
                whileTap={{ scale: 0.98 }}
                className="btn-whatsapp mt-2 w-full py-4 text-base"
              >
                <WhatsAppIcon size={20} />
                {unavailable ? "اسأل عن التوفّر عبر واتساب" : "اطلب الآن عبر واتساب"}
                <ArrowLeft size={16} />
              </motion.button>
              <p className="mt-2 text-center text-[11px] text-subtle">
                يفتح واتساب ورسالتك جاهزة بكل التفاصيل — ما عليك إلا ترسلها.
              </p>
              {toCurrency && <CalcExtras from={fromCode} to={toCurrency.code} rate={rate?.rate} multiply={usesMultiply} />}
            </div>
    </div>
  );
}
