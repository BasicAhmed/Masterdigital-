"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WhatsAppIcon from "./WhatsAppIcon";
import { MESSAGES } from "@/lib/whatsapp";
import { useContact } from "./ContactContext";

/** Floating WhatsApp button — appears once the visitor scrolls past the hero. */
export default function WhatsAppFab() {
  const { wa } = useContact();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.a
          href={wa(MESSAGES.general)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="تواصل معنا عبر واتساب"
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="fixed bottom-5 left-5 z-40 flex size-14 items-center justify-center rounded-2xl bg-whatsapp text-white shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)] transition-transform hover:scale-105"
        >
                    <WhatsAppIcon size={28} className="relative" />
        </motion.a>
      )}
    </AnimatePresence>
  );
}
