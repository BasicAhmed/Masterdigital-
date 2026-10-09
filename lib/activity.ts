import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "./firebase";
import { demoMode, listDocs, newId, saveDoc } from "./store";

/** Who did what. One record per action, never edited or deleted (the
 *  Firestore rules forbid it), so the log can be trusted. */

export type ActivityKind =
  | "transaction"
  | "customer"
  | "obligation"
  | "movement"
  | "rates"
  | "contact"
  | "alert"
  | "feedback"
  | "staff";

export type ActivityAction = "create" | "update" | "delete" | "import";

export interface Activity {
  id: string;
  at: string; // ISO
  uid: string;
  name: string;
  kind: ActivityKind;
  action: ActivityAction;
  refId: string;
  summary: string;
}

export const KIND_LABEL: Record<ActivityKind, string> = {
  transaction: "معاملة",
  customer: "عميل",
  obligation: "حسابات",
  movement: "سيولة",
  rates: "أسعار",
  contact: "تواصل",
  alert: "تنبيه",
  feedback: "اقتراح",
  staff: "فريق",
};

export const ACTION_TONE: Record<ActivityAction, string> = {
  create: "text-emerald-600 dark:text-emerald-400",
  update: "text-primary",
  delete: "text-red-500",
  import: "text-accent",
};

export interface Actor {
  uid: string;
  name: string;
}

let actor: Actor | null = null;
let listener: ((a: Activity) => void) | null = null;

/** Set once after login; every logActivity() call is signed with it. */
export function setActor(a: Actor | null) {
  actor = a;
}

/** Lets the open screen show new entries without reloading. */
export function onActivity(fn: ((a: Activity) => void) | null) {
  listener = fn;
}

/** Best effort: a failed log write never blocks the action itself. */
export async function logActivity(entry: { kind: ActivityKind; action: ActivityAction; refId?: string; summary: string }) {
  if (!actor) return;
  const rec: Activity = { id: newId(), at: new Date().toISOString(), uid: actor.uid, name: actor.name, refId: entry.refId ?? "", ...entry };
  listener?.(rec);
  await saveDoc("activity", rec).catch(() => undefined);
}

/** The latest entries, newest first. */
export async function getActivity(max = 1000): Promise<Activity[]> {
  if (demoMode || !db) {
    const all = await listDocs<Activity>("activity");
    return all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, max);
  }
  const snap = await getDocs(query(collection(db, "activity"), orderBy("at", "desc"), limit(max)));
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Activity, "id">), id: d.id }));
}

/** Stamp fields put on records so each one shows who made / last changed it. */
export interface Stamped {
  createdBy?: string;
  createdByName?: string;
  updatedBy?: string;
  updatedByName?: string;
  updatedAt?: string;
}

/** New record → created by me. Existing → keeps its creator, updated by me. */
export function stamp<T extends Stamped>(rec: T, isNew: boolean): T {
  if (!actor) return rec;
  if (isNew) return { ...rec, createdBy: actor.uid, createdByName: actor.name };
  return { ...rec, updatedBy: actor.uid, updatedByName: actor.name, updatedAt: new Date().toISOString() };
}
