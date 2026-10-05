import { Calculator, Send, BadgeCheck } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";

const STEPS = [
  {
    icon: Calculator,
    title: "احسب",
    desc: "اختار العملتين والمبلغ وشوف المبلغ اللي حيستلمه الطرف التاني بالضبط.",
  },
  {
    icon: null,
    title: "اطلب عبر واتساب",
    desc: "زر «اطلب الآن» يفتح واتساب ورسالتك جاهزة بكل التفاصيل.",
  },
  {
    icon: Send,
    title: "حوّل المبلغ",
    desc: "نأكد السعر ونرسل ليك تفاصيل الحساب عشان تحوّل.",
  },
  {
    icon: BadgeCheck,
    title: "استلم",
    desc: "المستلم يستلم المبلغ بعملته خلال دقائق.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="border-t border-border/60 py-20 sm:py-28">
      <div className="container-page">
        <p className="eyebrow">آلية العمل</p>
        <h2 className="section-heading mt-3">أربع خطوات، من البداية للنهاية.</h2>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <li key={s.title} className="card-sm relative overflow-hidden p-5">
                <span
                  aria-hidden="true"
                  className="absolute -left-2 -top-4 font-mono text-7xl font-extrabold text-primary/[0.07]"
                >
                  {i + 1}
                </span>
                <span
                  className={`relative inline-flex rounded-xl p-2.5 shadow-soft ${
                    Icon ? "bg-primary/10 text-primary" : "bg-whatsapp text-white"
                  }`}
                >
                  {Icon ? <Icon size={20} /> : <WhatsAppIcon size={20} />}
                </span>
                <h3 className="relative mt-4 font-display text-lg font-bold text-ink">
                  <span className="ml-1.5 font-mono text-sm text-subtle">0{i + 1}</span>
                  {s.title}
                </h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-muted">{s.desc}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
