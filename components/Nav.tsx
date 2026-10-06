"use client";

import { useEffect, useState } from "react";
import Brand from "./Brand";
import { Menu, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  { href: "#rates", label: "الأسعار" },
  { href: "#calculator", label: "الحاسبة" },
  { href: "#why", label: "لماذا ماستر" },
  { href: "#how", label: "كيف تعمل" },
  { href: "#faq", label: "الأسئلة الشائعة" },
  { href: "#feedback", label: "اقتراحات وشكاوى" },
  { href: "#contact", label: "تواصل معنا" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-border bg-surface/95 backdrop-blur" : "border-b border-transparent bg-surface"
      }`}
    >
      <nav className="container-page flex h-16 items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <Brand />
        </a>

        <div className="hidden items-center gap-7 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-semibold text-muted transition-colors hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <a
            href="#calculator"
            className="btn-primary px-5 py-2.5 text-sm"
          >
            اطلب الآن
          </a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            aria-label="فتح القائمة"
            className="text-ink"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border bg-bg px-5 pb-6 lg:hidden">
          <div className="flex flex-col gap-4 pt-4">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-base font-medium text-muted hover:text-ink"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#calculator"
              onClick={() => setOpen(false)}
              className="btn-primary mt-2 px-5 py-3 text-sm"
            >
              اطلب الآن
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
