"use client";

import { ArrowLeftRight, Banknote, Landmark, ReceiptText, Smartphone, Wallet } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import { useContact } from "./ContactContext";

const FINANCIAL = [
  { icon: ArrowLeftRight, label: "التحويلات المالية" },
  { icon: Banknote, label: "صرف العملات" },
  { icon: Landmark, label: "الخدمات المصرفية" },
];
const DIGITAL = [
  { icon: Wallet, label: "المحافظ الإلكترونية" },
  { icon: ReceiptText, label: "المدفوعات" },
  { icon: Smartphone, label: "الحلول الرقمية" },
];

/* ---------- Drawings for "other services": gold line art on the navy field ---------- */

const GOLD = "#C9A227";
const LINE = "rgba(255,255,255,0.55)";

function CardArt() {
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden="true">
      <g transform="rotate(-8 120 75)">
        <rect x="52" y="32" width="136" height="86" rx="12" fill="rgba(255,255,255,0.06)" stroke={LINE} strokeWidth="1.5" />
        <rect x="68" y="52" width="24" height="18" rx="4" fill="none" stroke={GOLD} strokeWidth="1.8" />
        <path d="M68 61h24M80 52v18" stroke={GOLD} strokeWidth="1.2" />
        <path d="M156 50a10 10 0 0 1 0 16M163 45a17 17 0 0 1 0 26M170 40a24 24 0 0 1 0 36" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M68 92h28M102 92h28M136 92h28" stroke={LINE} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.1 6" />
        <path d="M68 104h46" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function BillsArt() {
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden="true">
      <path d="M60 30h70v94l-7.5-6-7.5 6-7.5-6-7.5 6-7.5-6-7.5 6-7.5-6-7.5 6z" fill="rgba(255,255,255,0.06)" stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M72 48h46M72 62h34M72 76h40M72 96h22" stroke={LINE} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M104 96h14" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M146 58l6-14h44l6 14z" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M146 58a9 9 0 0 0 18 0a9 9 0 0 0 19 0a9 9 0 0 0 19 0" fill="none" stroke={GOLD} strokeWidth="1.8" />
      <path d="M152 66v40h44V66" fill="none" stroke={LINE} strokeWidth="1.5" />
      <path d="M166 106V86h16v20" fill="none" stroke={LINE} strokeWidth="1.5" />
      <circle cx="132" cy="112" r="13" fill="#06163a" stroke={GOLD} strokeWidth="1.8" />
      <path d="M126 112l4 4 8-8" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TravelArt() {
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden="true">
      <circle cx="100" cy="82" r="44" fill="rgba(255,255,255,0.06)" stroke={LINE} strokeWidth="1.5" />
      <ellipse cx="100" cy="82" rx="18" ry="44" fill="none" stroke={LINE} strokeWidth="1.2" />
      <path d="M56 82h88M62 60h76M62 104h76" stroke={LINE} strokeWidth="1.2" />
      <path d="M44 122C80 140 170 120 196 50" fill="none" stroke={GOLD} strokeWidth="1.8" strokeDasharray="5 6" strokeLinecap="round" />
      <g transform="translate(196 44) rotate(-58)">
        <path d="M0 -14l3 9 14 6v4l-14-2-2 8 5 4v3l-6-2-6 2v-3l5-4-2-8-14 2v-4l14-6z" fill={GOLD} />
      </g>
      <rect x="186" y="104" width="34" height="28" rx="5" fill="none" stroke={GOLD} strokeWidth="1.8" />
      <path d="M196 104v-6h14v6M197 112v12M209 112v12" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const OTHER = [
  { art: CardArt, title: "إصدار فيزا رقمية", desc: "بطاقة رقمية للدفع أونلاين والاشتراكات.", ask: "حابب أصدر فيزا رقمية" },
  { art: BillsArt, title: "سداد الفواتير", desc: "المتاجر والمنصات الرقمية وغيرها.", ask: "حابب أسدد فاتورة / مشتريات من متجر أو منصة رقمية" },
  { art: TravelArt, title: "خدمات السفر والسياحة", desc: "حجوزات ومدفوعات السفر.", ask: "حابب أستفسر عن خدمات السفر والسياحة" },
];

export default function Services() {
  const { wa } = useContact();

  return (
    <section id="services" className="border-t border-border py-16 sm:py-24">
      <div className="container-page">
        <h2 className="section-heading">خدماتنا</h2>
        <p className="mt-4 max-w-xl text-base leading-loose text-muted sm:text-lg">نقدم لكم حلولًا مالية ورقمية متكاملة، بسرعة وأمان وموثوقية.</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["خدماتنا المالية", FINANCIAL],
              ["خدماتنا الرقمية", DIGITAL],
            ] as const
          ).map(([title, items]) => (
            <div key={title} className="card p-6">
              <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
              <ul className="mt-4 space-y-3">
                {items.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-navy text-brand-gold">
                      <Icon size={18} />
                    </span>
                    <span className="font-semibold text-ink">{label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* other services, as pictures */}
        <h3 className="mt-14 font-display text-xl font-bold text-ink">خدمات أخرى</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          {OTHER.map(({ art: Art, title, desc, ask }) => (
            <article key={title} className="card overflow-hidden p-0">
              <div className="navy-field relative aspect-[16/10]">
                <div aria-hidden="true" className="shield-lines absolute inset-0" />
                <div className="relative h-full p-3">
                  <Art />
                </div>
              </div>
              <div className="p-5">
                <h4 className="font-display text-base font-bold text-ink">{title}</h4>
                <p className="mt-1 text-sm text-muted">{desc}</p>
                <a
                  href={wa(`السلام عليكم 👋\n${ask}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                >
                  <WhatsAppIcon size={15} className="text-whatsapp" /> اطلب الخدمة
                </a>
              </div>
            </article>
          ))}
        </div>

        {/* vision */}
        <div className="navy-field on-navy relative mt-14 overflow-hidden rounded-[1.5rem] p-8 sm:p-10" style={{ boxShadow: "inset 0 2px 0 #c9a227" }}>
          <div aria-hidden="true" className="shield-lines pointer-events-none absolute inset-0" />
          <div className="relative max-w-2xl">
            <p className="text-sm font-semibold text-brand-gold">رؤيتنا</p>
            <p className="mt-3 font-display text-xl font-bold leading-relaxed text-white sm:text-2xl">
              بناء ثقة مستمرة مع عملائنا من خلال المصداقية، سرعة الإنجاز، وجودة الخدمة.
            </p>
            <p className="mt-6 text-sm text-white/70">ثقتكم أساس نجاحنا، وخدمتكم أولويتنا.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
