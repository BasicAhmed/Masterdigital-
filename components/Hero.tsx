"use client";

import { motion } from "framer-motion";
import { Megaphone } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import Calculator, { SELECT_PAIR_EVENT, type SelectPairDetail } from "./Calculator";
import { MESSAGES } from "@/lib/whatsapp";
import { useContact } from "./ContactContext";
import { CURRENCY_LIST } from "@/lib/currencies";
import type { RateRow } from "@/lib/rates";

export const PAYMENT_METHODS = ["بنكك", "USDT", "Vodafone Cash", "M-Pesa", "MTN Mobile Money"];

/** The opening screen is the business itself: the navy field from the logo,
 *  one line that says what happens, and the calculator ready to use. */
export default function Hero({ rates, disabledFlows }: { rates: RateRow[]; disabledFlows: string[] }) {
  const { wa, channel } = useContact();
  return (
    <section id="top" className="navy-field on-navy relative overflow-hidden">
      <div aria-hidden="true" className="shield-lines pointer-events-none absolute inset-0" />

      <div className="container-page relative grid gap-10 pb-16 pt-10 lg:grid-cols-[1fr_minmax(0,29rem)] lg:items-center lg:gap-14 lg:pb-24 lg:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="font-display text-[clamp(2.6rem,11vw,5.25rem)] font-black leading-[1.18] tracking-tight">
            تحويلات سريعة
            <span className="mt-1 block text-[0.42em] font-bold leading-[1.5] text-brand-gold">خلال دقائق</span>
          </h1>

          <p className="mt-6 max-w-md text-base leading-loose text-muted sm:text-lg">
            ماستر للخدمات المصرفية — حوّل بين السودان ومصر وأوغندا ورواندا وكينيا و USDT، في الاتجاهين وبسعر واضح.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={wa(MESSAGES.general)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-7 py-3.5 text-sm">
              <WhatsAppIcon size={18} /> تواصل عبر واتساب
            </a>
            <a href="#rates" className="inline-flex items-center justify-center rounded-xl border border-white/25 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:border-white/60">
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

          <dl className="mt-10 grid max-w-md grid-cols-3 border-t border-white/15 pt-6 text-sm">
            {[
              ["تحويلات", "آمنة وسريعة"],
              ["أسعار", "محدثة باستمرار"],
              ["خدمة عملاء", "على مدار اليوم"],
            ].map(([a, b]) => (
              <div key={a} className="border-white/15 px-3 first:pr-0 [&:not(:first-child)]:border-r">
                <dt className="font-display font-bold text-white">{a}</dt>
                <dd className="mt-0.5 text-xs text-muted">{b}</dd>
              </div>
            ))}
          </dl>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        >
          <Calculator rates={rates} disabledFlows={disabledFlows} />
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5" dir="ltr">
            {CURRENCY_LIST.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent<SelectPairDetail>(SELECT_PAIR_EVENT, { detail: { from: c.code } }))
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-white/85 transition-colors hover:border-brand-gold hover:text-white"
              >
                <span className="text-sm">{c.flag}</span>
                {c.code}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
