import { Zap, TrendingUp, ShieldCheck, Wallet, Globe2, MessageCircle } from "lucide-react";

const ITEMS = [
  { icon: Zap, title: "تحويل سريع", desc: "تحويلك يتنفذ خلال دقائق — بدون زيارة فرع أو انتظار." },
  { icon: TrendingUp, title: "سعر واضح لكل اتجاه", desc: "أسعار البيع والشراء معروضة ومحدثة بشكل مستمر." },
  { icon: ShieldCheck, title: "تحويلات آمنة", desc: "كل طلب يتم تأكيده معك مباشرة قبل ما تتحرك أي أموال." },
  { icon: Wallet, title: "طرق دفع متعددة", desc: "بنكك، USDT، Vodafone Cash، M-Pesa و MTN Mobile Money." },
  { icon: Globe2, title: "90 مسار تحويل", desc: "بين السودان وجنوب السودان ومصر وأوغندا ورواندا وكينيا والسعودية والإمارات، و USDT والدولار كاش، في الاتجاهين." },
  { icon: MessageCircle, title: "خدمة عملاء على مدار اليوم", desc: "ردود من شخص حقيقي عبر واتساب." },
];

export default function WhyChoose() {
  return (
    <section id="why" className="border-t border-border py-16 sm:py-24">
      <div className="container-page">
        <h2 className="section-heading">لماذا ماستر</h2>

        <div className="mt-10 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4 border-t border-border py-6">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-navy text-brand-gold">
                <Icon size={20} />
              </span>
              <div>
                <h3 className="font-display text-base font-bold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
