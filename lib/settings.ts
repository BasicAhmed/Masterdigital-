import { readDoc, saveDoc } from "./store";

/** Public contact details shown on the site and used for every WhatsApp link. */
export interface ContactSettings {
  whatsapp: string;
  channel: string; // "" = hidden
  email: string; // "" = hidden
  hours: string; // "" = hidden
}

export const DEFAULT_CONTACT: ContactSettings = {
  whatsapp: "+256 780 112 222",
  channel: "",
  email: "",
  hours: "خدمة عملاء على مدار اليوم",
};

export async function getContactSettings(): Promise<ContactSettings> {
  try {
    const x = await readDoc<Partial<ContactSettings>>("settings", "contact");
    if (!x) return DEFAULT_CONTACT;
    const str = (v: unknown, fallback: string) => (typeof v === "string" ? v : fallback);
    return {
      whatsapp: str(x.whatsapp, DEFAULT_CONTACT.whatsapp) || DEFAULT_CONTACT.whatsapp,
      channel: str(x.channel, DEFAULT_CONTACT.channel),
      email: str(x.email, DEFAULT_CONTACT.email),
      hours: str(x.hours, DEFAULT_CONTACT.hours),
    };
  } catch {
    return DEFAULT_CONTACT;
  }
}

export async function setContactSettings(c: ContactSettings) {
  await saveDoc("settings", { id: "contact", ...c });
}
