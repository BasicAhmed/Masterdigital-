/** Fallback only — the live number comes from /admin → التواصل (settings/contact). */
export const WHATSAPP_NUMBER = "256780112222";

/** "+60 12-345 6789" → "60123456789" (the format wa.me needs). */
export function waDigits(number: string) {
  return number.replace(/\D/g, "").replace(/^00/, "");
}

// Left-to-right mark: keeps "100,000 SDG" in the right order inside Arabic text.
const LRM = "‎";
const ltr = (s: string) => `${LRM}${s}${LRM}`;

export interface OrderDetails {
  amountReceived: string;
  toCurrency: string;
  toName?: string;
  amountSent: string;
  fromCurrency: string;
  fromName?: string;
  rateLine?: string;
  discountNote?: string;
}

/** Order message sent from the calculator — structured so the admin can read
 *  the whole request at a glance. */
export function buildOrderMessage(o: OrderDetails): string {
  const from = `${o.fromName ?? o.fromCurrency} ${ltr(`(${o.fromCurrency})`)}`;
  const to = `${o.toName ?? o.toCurrency} ${ltr(`(${o.toCurrency})`)}`;
  return [
    "السلام عليكم 👋",
    "عاوز أعمل تحويل عن طريق Master Digital:",
    "",
    `🔁 *التحويل:* من ${from} إلى ${to}`,
    `💸 *حرسل:* ${ltr(`${o.amountSent} ${o.fromCurrency}`)}`,
    `✅ *المستلم يستلم:* ${ltr(`${o.amountReceived} ${o.toCurrency}`)}`,
    ...(o.rateLine ? [`📊 *السعر:* ${ltr(o.rateLine)}`] : []),
    ...(o.discountNote ? [`🎁 ${o.discountNote}`] : []),
    "",
    "ممكن ترسل لي تفاصيل الحساب عشان أحوّل؟ شكراً 🙏",
  ].join("\n");
}

/** Sent when the chosen direction is switched off in /admin. */
export function buildAvailabilityMessage(fromCode: string, toCode: string, fromName?: string, toName?: string): string {
  return [
    "السلام عليكم 👋",
    `التحويل من ${fromName ?? fromCode} ${ltr(`(${fromCode})`)} إلى ${toName ?? toCode} ${ltr(`(${toCode})`)} ظاهر غير متاح حالياً في الموقع.`,
    "متين حيكون متاح؟ وهل في طريقة تانية أقدر أحوّل بيها؟ 🙏",
  ].join("\n");
}

export const MESSAGES = {
  general: "السلام عليكم 👋\nعندي استفسار عن التحويل عن طريق Master Digital.",
  rates: "السلام عليكم 👋\nممكن تأكد لي أسعار اليوم؟",
};

export function whatsappLink(message: string, number: string = WHATSAPP_NUMBER): string {
  return `https://wa.me/${waDigits(number) || WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
