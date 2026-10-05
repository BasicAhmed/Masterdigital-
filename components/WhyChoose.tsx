import { Zap, TrendingUp, ShieldCheck, Wallet, Globe2, MessageCircle } from "lucide-react";

const ITEMS = [
  {
    icon: Zap,
    title: "تحويل سريع",
    desc: "تحويلك يتنفذ خلال دقائق — بدون زيارة فرع أو انتظار.",
  },
  {
    icon: TrendingUp,
    title: "أفضل سعر صرف",
    desc: "أسعار بيع وشراء واضحة لكل اتجاه، محدثة بشكل مستمر.",
  },
  {
    icon: ShieldCheck,
    title: "تحويلات آمنة",
    desc: "كل طلب يتم تأكيده معك مباشرة قبل ما تتحرك أي أموال.",
  },
  {
    icon: Wallet,
    title: "طرق دفع متعددة",
    desc: "بنكك، USDT، Vodafone Cash، M-Pesa و MTN Mobile Money — ادفع واستلم بالطريقة الأسهل ليك.",
  },
  {
    icon: Globe2,
    title: "دول متعددة",
    desc: "18 مسار تحويل في الاتجاهين بين السودان ومصر وأوغندا ورواندا وكينيا و USDT.",
  },
  {
    icon: MessageCircle,
    title: "دعم فوري عبر واتساب",
    desc: "خدمة عملاء على مدار اليوم — ردود من شخص حقيقي.",
  },
];

export default function WhyChoose() {
  return (
    <section id="why" className="border-t border-border py-20 sm:py-28">
      <div className="container-page">
        <p className="eyebrow">لماذا ماستر</p>
        <h2 className="section-heading mt-3">تحويلات آمنة وسريعة، بسعر واضح من أول مرة.</h2>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="card-sm p-6 transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card"
            >
              <div className="inline-flex rounded-xl bg-primary/10 p-2.5 text-primary">
                <Icon size={20} />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
