"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowDown, Clock3, Megaphone, ShieldCheck, Star, TrendingUp } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import Calculator, { SELECT_PAIR_EVENT, type SelectPairDetail } from "./Calculator";
import { MESSAGES } from "@/lib/whatsapp";
import { useContact } from "./ContactContext";
import { CURRENCY_LIST, type CurrencyCode } from "@/lib/currencies";
import { useFavorites } from "@/lib/favorites";
import { formatRelativeTime } from "@/lib/relativeTime";
import type { RateRow } from "@/lib/rates";

export const PAYMENT_METHODS = ["بنكك", "USDT", "Vodafone Cash", "M-Pesa", "MTN Mobile Money"];

const PROOF = [
  { icon: Clock3, title: "خلال دقائق", text: "تحويلك يتنفذ بعد تأكيد الدفع مباشرة" },
  { icon: TrendingUp, title: "سعر واضح", text: "تشوف السعر والمبلغ قبل ما تحوّل" },
  { icon: ShieldCheck, title: "تحويل آمن", text: "نأكد كل طلب معاك قبل أي حركة" },
];

function select(detail: SelectPairDetail) {
  window.dispatchEvent(new CustomEvent<SelectPairDetail>(SELECT_PAIR_EVENT, { detail }));
}

/** First screen: what Master Digital does, in one line, with the tool that
 *  does it right beside it. The navy field and gold thread come from the
 *  shield logo, which also sits large and faint behind the headline. */
export default function Hero({ rates, disabledFlows }: { rates: RateRow[]; disabledFlows: string[] }) {
  const { wa, channel } = useContact();
  const { favorites } = useFavorites();
  const lastUpdated = rates
    .map((r) => r.updatedAt)
    .filter((d): d is string => !!d)
    .sort()
    .pop();
  const favRoutes = favorites
    .map((k) => k.split("_") as [CurrencyCode, CurrencyCode])
    .filter(([f, t]) => rates.some((r) => r.from === f && r.to === t));

  return (
    <section id="top" className="navy-field on-navy relative overflow-hidden">
      <div aria-hidden="true" className="shield-lines pointer-events-none absolute inset-0" />
      <Image
        src="/logo.png"
        alt=""
        aria-hidden="true"
        width={720}
        height={720}
        className="pointer-events-none absolute -right-40 top-10 hidden w-[640px] select-none opacity-[0.07] lg:block"
      />

      <div className="container-page relative grid gap-10 pb-14 pt-10 lg:grid-cols-[1fr_minmax(0,29rem)] lg:items-center lg:gap-16 lg:pb-20 lg:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/90">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            أسعار اليوم محدثة{lastUpdated ? ` — ${formatRelativeTime(lastUpdated)}` : ""}
          </p>

          <h1 className="mt-6 font-display text-[clamp(2.5rem,10.5vw,4.75rem)] font-black leading-[1.22] tracking-tight">
            حوّل أموالك
            <span className="block text-brand-gold">خلال دقائق</span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-loose text-muted sm:text-lg">
            ماستر للخدمات المصرفية يحوّل ليك بين السودان ومصر وأوغندا ورواندا وكينيا، وبالـ USDT — في الاتجاهين. تشوف
            السعر والمبلغ اللي حيوصل قبل ما ترسل أي حاجة.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#calculator" className="btn-gold px-7 py-3.5 text-sm lg:hidden">
              احسب تحويلك <ArrowDown size={16} />
            </a>
            <a href={wa(MESSAGES.general)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-7 py-3.5 text-sm">
              <WhatsAppIcon size={18} /> تواصل عبر واتساب
            </a>
            <a
              href="#rates"
              className="inline-flex items-center justify-center rounded-xl border border-white/25 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:border-white/60"
            >
              أسعار اليوم
            </a>
            {channel && (
              <a
                href={channel}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:border-white/60"
              >
                <Megaphone size={16} className="text-brand-gold" /> قناة الواتساب
              </a>
            )}
          </div>

          <ul className="mt-10 hidden gap-3 sm:grid sm:grid-cols-3">
            {PROOF.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <Icon size={20} className="text-brand-gold" />
                <p className="mt-3 font-display text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Calculator rates={rates} disabledFlows={disabledFlows} />

          {/* Quick access: the visitor's own favourites when they have any, otherwise every currency */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5" dir="ltr">
            {favRoutes.length > 0
              ? favRoutes.map(([f, t]) => (
                  <button
                    key={`${f}${t}`}
                    type="button"
                    onClick={() => select({ from: f, to: t })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-gold/50 bg-brand-gold/10 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-white transition-colors hover:border-brand-gold"
                  >
                    <Star size={11} className="text-brand-gold" fill="currentColor" />
                    {f} → {t}
                  </button>
                ))
              : CURRENCY_LIST.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => select({ from: c.code })}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-white/85 transition-colors hover:border-brand-gold hover:text-white"
                  >
                    <span className="text-sm">{c.flag}</span>
                    {c.code}
                  </button>
                ))}
          </div>
        </motion.div>
      </div>

      {/* How customers pay and get paid — the question everyone asks first */}
      <div className="relative border-t border-white/10 bg-black/20">
        <div className="container-page flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-4 lg:justify-between">
          <p className="text-xs font-semibold text-white/70">ادفع واستلم عبر</p>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {PAYMENT_METHODS.map((m) => (
              <li key={m} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#06163a]" dir="auto">
                {m}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
