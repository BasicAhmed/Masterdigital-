/** Fallback only — the live number comes from /admin → التواصل (settings/contact). */
export const WHATSAPP_NUMBER = "256780112222";

export function waDigits(number: string) {
  return number.replace(/\D/g, "").replace(/^00/, "");
}

const LRM = "‎";
const ltr = (s: string) => `${LRM}${s}${LRM}`;

export interface OrderDetails {
  amountSent: string;
  fromCode: string;
  fromName: string;
  amountReceived: string;
  toCode: string;
  toName: string;
  rateLine: string;
}

export function buildOrderMessage(o: OrderDetails): string {
  return [
    "السلام عليكم 👋",
    "عاوز أعمل تحويل عن طريق Master Digital:",
    "",
    `🔁 *التحويل:* من ${o.fromName} ${ltr(`(${o.fromCode})`)} إلى ${o.toName} ${ltr(`(${o.toCode})`)}`,
    `💸 *حرسل:* ${ltr(`${o.amountSent} ${o.fromCode}`)}`,
    `✅ *المستلم يستلم:* ${ltr(`${o.amountReceived} ${o.toCode}`)}`,
    `📊 *السعر:* ${ltr(o.rateLine)}`,
    "",
    "ممكن ترسل لي تفاصيل الحساب عشان أحوّل؟ شكراً 🙏",
  ].join("\n");
}

export function buildAvailabilityMessage(fromName: string, toName: string): string {
  return [
    "السلام عليكم 👋",
    `التحويل من ${fromName} إلى ${toName} ظاهر غير متاح حالياً في الموقع.`,
    "متين حيكون متاح؟ 🙏",
  ].join("\n");
}

export const MESSAGES = {
  general: "السلام عليكم 👋\nعندي استفسار عن التحويل عن طريق Master Digital.",
  rates: "السلام عليكم 👋\nممكن تأكد لي أسعار اليوم؟",
};

export function whatsappLink(message: string, number: string = WHATSAPP_NUMBER): string {
  return `https://wa.me/${waDigits(number) || WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
