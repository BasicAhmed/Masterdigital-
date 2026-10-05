"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, Zap, Headphones, Megaphone, Timer } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import { SELECT_PAIR_EVENT, type SelectPairDetail } from "./Calculator";
import { MESSAGES } from "@/lib/whatsapp";
import { useContact } from "./ContactContext";
import { CURRENCY_LIST } from "@/lib/currencies";

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
});

const STATS = [
  { icon: Zap, value: "تحويلات آمنة وسريعة", label: "تنفيذ خلال دقائق" },
  { icon: ShieldCheck, value: "أسعار محدثة", label: "بشكل مستمر" },
  { icon: Headphones, value: "خدمة عملاء", label: "على مدار اليوم" },
];

export const PAYMENT_CHIPS = ["بنكك", "USDT", "Vodafone Cash", "M-Pesa", "MTN Mobile Money"];

export default function Hero() {
  const { wa, channel } = useContact();
  return (
    <section id="top" className="relative overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-fade" />
        <div className="absolute inset-0 bg-dot-grid [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
        <div className="absolute -top-32 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      </div>

      <div className="container-page flex flex-col items-center pb-16 pt-12 text-center sm:pb-20 sm:pt-16">
        <motion.p
          {...rise(0.05)}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-surface/80 px-3.5 py-1.5 text-xs font-semibold text-muted shadow-soft backdrop-blur"
        >
          <Timer size={14} className="text-accent" />
          خلال دقائق
        </motion.p>

        <motion.h1
          {...rise(0.1)}
          className="mt-5 max-w-3xl font-display text-[clamp(2rem,9vw,4.25rem)] font-black leading-[1.25] tracking-tight text-ink"
        >
          تحويلات <span className="text-gradient">سريعة</span>
          <br />
          <span className="text-[0.62em] font-extrabold text-muted">مع ماستر للخدمات المصرفية</span>
        </motion.h1>

        <motion.p {...rise(0.15)} className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          حوّل بين الجنيه السوداني والجنيه المصري والشلن الأوغندي والفرنك الرواندي والشلن الكيني و USDT — في
          الاتجاهين، بسعر واضح وتنفيذ سريع.
        </motion.p>

        <motion.div {...rise(0.2)} className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <a href="#calculator" className="btn-primary px-8 py-3.5 text-sm">
            احسب تحويلك <ArrowLeft size={16} />
          </a>
          <a href={wa(MESSAGES.general)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-8 py-3.5 text-sm">
            <WhatsAppIcon size={18} /> تواصل عبر واتساب
          </a>
          {channel && (
            <a
              href={channel}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-whatsapp/40 bg-whatsapp/10 px-8 py-3.5 text-sm font-bold text-ink shadow-soft transition-all hover:-translate-y-px hover:border-whatsapp/70"
            >
              <Megaphone size={17} className="text-whatsapp" /> قناة الواتساب
            </a>
          )}
        </motion.div>

        <motion.div {...rise(0.25)} className="mt-8 flex flex-col items-center gap-2.5">
          <p className="text-[11px] font-medium text-subtle">اختر عملتك وابدأ الحساب</p>
          <div className="flex flex-wrap justify-center gap-2" dir="ltr">
            {CURRENCY_LIST.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent<SelectPairDetail>(SELECT_PAIR_EVENT, { detail: { from: c.code } }))
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-surface px-3 py-1.5 font-mono text-xs font-semibold text-ink shadow-soft transition-all hover:-translate-y-px hover:border-primary/60 hover:text-primary"
              >
                <span className="text-sm">{c.flag}</span>
                {c.code}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          {...rise(0.3)}
          className="card mt-10 grid w-full max-w-2xl grid-cols-3 divide-x divide-x-reverse divide-border/70 p-2"
        >
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center px-2 py-3">
              <span className="mb-2 rounded-xl bg-primary/10 p-2 text-primary">
                <Icon size={16} />
              </span>
              <span className="font-display text-xs font-bold text-ink sm:text-base">{value}</span>
              <span className="mt-0.5 text-[11px] text-subtle sm:text-xs">{label}</span>
            </div>
          ))}
        </motion.div>

        <motion.div {...rise(0.35)} className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[11px] font-medium text-subtle">طرق الدفع والاستلام:</span>
          {PAYMENT_CHIPS.map((p) => (
            <span key={p} className="rounded-full border border-border/70 bg-surface px-3 py-1 text-[11px] font-semibold text-muted shadow-soft" dir="auto">
              {p}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
