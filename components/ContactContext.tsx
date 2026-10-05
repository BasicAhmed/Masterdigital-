"use client";

import { createContext, useContext } from "react";
import { DEFAULT_CONTACT, type ContactSettings } from "@/lib/settings";
import { whatsappLink } from "@/lib/whatsapp";

const ContactContext = createContext<ContactSettings>(DEFAULT_CONTACT);

export function ContactProvider({ value, children }: { value: ContactSettings; children: React.ReactNode }) {
  return <ContactContext.Provider value={value}>{children}</ContactContext.Provider>;
}

/** Contact details from /admin plus a WhatsApp link builder bound to the live number. */
export function useContact() {
  const contact = useContext(ContactContext);
  return { ...contact, wa: (message: string) => whatsappLink(message, contact.whatsapp) };
}
