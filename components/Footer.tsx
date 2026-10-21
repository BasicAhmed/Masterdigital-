"use client";

import SiteBrand from "./SiteBrand";
import { Megaphone } from "lucide-react";
import WhatsAppIcon from "./WhatsAppIcon";
import { useContact } from "./ContactContext";
import { MESSAGES } from "@/lib/whatsapp";

export default function Footer() {
  const { channel, wa } = useContact();

  return (
    <footer className="ribbon py-10 pb-24 sm:pb-10 on-navy">
      <div className="container-page flex flex-col items-center justify-between gap-5 sm:flex-row">
        <SiteBrand size={36} />

        <div className="flex items-center gap-2">
          <a
            href={wa(MESSAGES.general)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:border-whatsapp"
          >
            <WhatsAppIcon size={14} className="text-whatsapp" /> واتساب
          </a>
          {channel && (
            <a
              href={channel}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:border-whatsapp"
            >
              <Megaphone size={14} className="text-whatsapp" /> قناة واتساب
            </a>
          )}
        </div>

        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-white">ثقتكم أساس نجاحنا، وخدمتكم أولويتنا.</p>
          <p className="mt-1 text-xs text-subtle">
            © {new Date().getFullYear()} تحديث سعر الصرف. الأسعار المعروضة تقريبية ويتم تأكيدها وقت الطلب.
          </p>
        </div>
      </div>

      <div className="container-page mt-6 flex justify-center border-t border-white/10 pt-5">
        <a
          href="https://ninotechy.com"
          target="_blank"
          rel="noopener"
          dir="ltr"
          className="group inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-subtle/80 transition-colors hover:text-ink"
        >
          By
          <span className="font-bold text-muted transition-colors group-hover:text-primary">Nino Techy</span>
        </a>
      </div>
    </footer>
  );
}
