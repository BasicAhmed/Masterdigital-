import type { CurrencyCode } from "./corridors";
import { isForwardDirection } from "./corridors";
import { listDocs, removeDoc, saveDoc } from "./store";

/** A customer's price alert: "tell me when FROM → TO reaches this rate".
 *  The target is written in the same form the calculator shows the rate
 *  (e.g. 1 USDT = 8100 SDG), so the customer types the number they see. */
export type AlertStatus = "active" | "reached" | "notified";

export interface RateAlert {
  id: string;
  from: CurrencyCode;
  to: CurrencyCode;
  target: number;
  rateAtCreation: number;
  name: string;
  whatsapp: string;
  email: string; // "" when not given
  status: AlertStatus;
  createdAt: string;
  reachedAt: string; // "" until reached
  reachedRate: number;
}

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  active: "في الانتظار",
  reached: "وصل السعر",
  notified: "تم الإبلاغ",
};

/** A higher quoted rate is better for the customer when the route multiplies
 *  (they get more per unit); a lower one is better when it divides. */
export function higherIsBetter(from: CurrencyCode, to: CurrencyCode): boolean {
  return !isForwardDirection(from, to);
}

export function isReached(a: Pick<RateAlert, "from" | "to" | "target">, currentRate: number): boolean {
  if (!currentRate || !a.target) return false;
  return higherIsBetter(a.from, a.to) ? currentRate >= a.target : currentRate <= a.target;
}

export const getAlerts = () => listDocs<RateAlert>("alerts");
export const saveAlert = (a: RateAlert) => saveDoc("alerts", a);
export const deleteAlert = (id: string) => removeDoc("alerts", id);

// ---------- Suggestions & complaints ----------

export type FeedbackType = "suggestion" | "complaint" | "problem";
export type FeedbackStatus = "new" | "handled";

export interface Feedback {
  id: string;
  type: FeedbackType;
  name: string;
  contact: string;
  message: string;
  status: FeedbackStatus;
  reply: string; // staff note on how it was handled
  createdAt: string;
}

export const FEEDBACK_LABEL: Record<FeedbackType, string> = {
  suggestion: "اقتراح",
  complaint: "شكوى",
  problem: "بلاغ عن مشكلة",
};

export const getFeedback = () => listDocs<Feedback>("feedback");
export const saveFeedback = (f: Feedback) => saveDoc("feedback", f);
export const deleteFeedback = (id: string) => removeDoc("feedback", id);
