const STEPS = [
  { title: "احسب", desc: "اختار العملتين والمبلغ وشوف المبلغ اللي حيستلمه الطرف التاني بالضبط." },
  { title: "اطلب عبر واتساب", desc: "زر «اطلب الآن» يفتح واتساب ورسالتك جاهزة بكل التفاصيل." },
  { title: "حوّل المبلغ", desc: "نأكد السعر ونرسل ليك تفاصيل الحساب عشان تحوّل." },
  { title: "استلم", desc: "المستلم يستلم المبلغ بعملته خلال دقائق." },
];

/** Four real steps in order, so they are numbered and joined by one line. */
export default function HowItWorks() {
  return (
    <section id="how" className="border-t border-border bg-surface py-16 sm:py-24">
      <div className="container-page">
        <h2 className="section-heading">كيف تحوّل</h2>

        <ol className="relative mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          <span aria-hidden="true" className="absolute inset-x-0 top-6 hidden h-px bg-border lg:block" />
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="relative flex size-12 items-center justify-center rounded-full bg-brand-navy font-display text-lg font-extrabold text-brand-gold ring-8 ring-surface">
                {i + 1}
              </span>
              <h3 className="mt-5 font-display text-lg font-bold text-ink">{s.title}</h3>
              <p className="mt-2 max-w-[17rem] text-sm leading-relaxed text-muted">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
