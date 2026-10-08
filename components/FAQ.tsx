"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    q: "كم يستغرق التحويل؟",
    a: "أغلب التحويلات تتنفذ خلال دقائق بعد تأكيد الدفع. بعض الحالات قد تستغرق وقت أطول حسب مواعيد عمل البنوك وشبكات الدفع.",
  },
  {
    q: "فيه حد أدنى أو أقصى للمبلغ؟",
    a: "الحد الأدنى والأقصى يختلف حسب المسار. أرسل لنا رسالة على واتساب بالمبلغ ونأكد لك فوراً.",
  },
  {
    q: "كيف أضمن إن السعر ما يتغير بعد ما أرسل الفلوس؟",
    a: "السعر اللي نأكده معك على واتساب هو نفس السعر اللي تحصل عليه. يكون مثبّت لتلك المعاملة.",
  },
  {
    q: "شنو العملات والدول المدعومة؟",
    a: "نحوّل في الاتجاهين بين 10 عملات: الجنيه السوداني، الدولار (جنوب السودان)، الجنيه المصري، الشلن الأوغندي، الفرنك الرواندي، الشلن الكيني، الريال السعودي، الدرهم الإماراتي، الدولار كاش، و USDT. اختار عملتك في الحاسبة وحتظهر ليك كل العملات المتاحة معها، وكل الأسعار موضحة في الجدول.",
  },
  {
    q: "فيه رسوم إضافية؟",
    a: "السعر اللي تشوفه في الحاسبة هو سعر التحويل. رسوم التحويل (إن وُجدت) يتم خصمها من المبلغ المستلم ونوضحها ليك قبل التنفيذ.",
  },
  {
    q: "شنو طرق الدفع والاستلام؟",
    a: "بنكك، USDT، Vodafone Cash، M-Pesa و MTN Mobile Money — حسب العملة والدولة.",
  },
  {
    q: "كيف أبدأ طلب؟",
    a: "استخدم الحاسبة أعلاه، اضغط «اطلب الآن»، وواتساب يفتح وتفاصيلك جاهزة. نكمل الباقي من عندنا.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-border py-16 sm:py-24">
      <div className="container-page">
        <h2 className="section-heading">أسئلة شائعة</h2>

        <div className="mt-10 max-w-3xl divide-y divide-border border-y border-border">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q}>
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-right"
                >
                  <span className="font-display font-bold text-ink">{item.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-subtle transition-transform ${
                      isOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="pb-6 text-sm leading-loose text-muted">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
