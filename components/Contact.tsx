"use client";

import { Mail, Clock, ArrowLeft, Megaphone } from "lucide-react";
import { MESSAGES } from "@/lib/whatsapp";
import WhatsAppIcon from "./WhatsAppIcon";
import { useContact } from "./ContactContext";

export default function Contact() {
  const { whatsapp, channel, email, hours, wa } = useContact();

  return (
    <section id="contact" className="py-16 sm:py-24">
      <div className="container-page">
        <div className="navy-field on-navy relative grid gap-10 overflow-hidden rounded-[1.75rem] p-6 sm:p-12 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <h2 className="section-heading">تكلم معنا مباشرة</h2>
            <p className="mt-3 max-w-md text-muted">
              ردود حقيقية، مو تذاكر آلية. خدمة العملاء متاحة على مدار اليوم وبنرد عليك بسرعة.
            </p>
          </div>

          <div className="space-y-4">
            <a
              href={wa(MESSAGES.general)}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-4 rounded-2xl border border-whatsapp/50 bg-whatsapp/15 p-4 transition-all hover:-translate-y-px hover:border-whatsapp/60"
            >
              <div className="rounded-xl bg-whatsapp p-2.5 text-white shadow-[0_8px_20px_-6px_rgba(37,211,102,0.6)]">
                <WhatsAppIcon size={22} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-ink">واتساب — أسرع طريقة</div>
                <div className="text-sm text-muted" dir="ltr">
                  {whatsapp}
                </div>
              </div>
              <ArrowLeft size={18} className="text-whatsapp transition-transform group-hover:-translate-x-1" />
            </a>

            {channel && (
              <a
                href={channel}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-4 transition-all hover:-translate-y-px hover:border-whatsapp/60"
              >
                <div className="rounded-xl bg-whatsapp/15 p-2.5 text-whatsapp">
                  <Megaphone size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">قناتنا على واتساب</div>
                  <div className="text-sm text-muted">تابعنا عشان توصلك الأسعار والعروض أول بأول</div>
                </div>
                <ArrowLeft size={18} className="text-subtle transition-transform group-hover:-translate-x-1" />
              </a>
            )}

            {email && (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-4 transition-colors hover:border-primary"
              >
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                  <Mail size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink">البريد الإلكتروني</div>
                  <div className="text-sm text-muted" dir="ltr">
                    {email}
                  </div>
                </div>
              </a>
            )}

            {hours && (
              <div className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/5 p-4">
                <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
                  <Clock size={20} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-ink">ساعات العمل</div>
                  <div className="text-sm text-muted">{hours}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
