import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db, firebaseConfig, firebaseEnabled } from "./firebase";
import { listDocs, saveDoc } from "./store";

/** Staff accounts. Every login has a record at staff/{uid} saying who they
 *  are and what they may do. The owner can do everything and is the only
 *  one who manages staff. Firestore rules enforce the same permissions, so
 *  hiding a button is never the only protection. */

export type Perm =
  | "finance"
  | "tx_add"
  | "tx_edit"
  | "customers"
  | "ledger"
  | "liquidity"
  | "rates"
  | "inbox"
  | "contact"
  | "activity";

export const PERMS: { key: Perm; label: string; hint: string }[] = [
  { key: "tx_add", label: "تسجيل معاملات", hint: "يضيف معاملات ويعدّل اللي سجلها هو بس" },
  { key: "tx_edit", label: "تعديل وحذف كل المعاملات", hint: "حتى معاملات غيره" },
  { key: "customers", label: "إدارة العملاء", hint: "تعديل، حذف واستيراد العملاء" },
  { key: "finance", label: "المالية والأرباح", hint: "يشوف الإيراد والربح والتقارير" },
  { key: "ledger", label: "الحسابات (لنا / علينا)", hint: "" },
  { key: "liquidity", label: "السيولة", hint: "إيداع وسحب" },
  { key: "rates", label: "الأسعار والهوامش", hint: "يغيّر أسعار الموقع" },
  { key: "inbox", label: "التنبيهات والاقتراحات", hint: "" },
  { key: "contact", label: "بيانات التواصل", hint: "" },
  { key: "activity", label: "سجل النشاط وأداء الفريق", hint: "يشوف مين عمل شنو" },
];

export const PRESETS: { label: string; perms: Perm[] }[] = [
  { label: "موظف", perms: ["tx_add"] },
  { label: "موظف + عملاء", perms: ["tx_add", "customers"] },
  { label: "محاسب", perms: ["tx_add", "tx_edit", "customers", "finance", "ledger", "liquidity"] },
  { label: "مدير", perms: PERMS.map((p) => p.key) },
];

export type StaffRole = "owner" | "staff";
export type StaffStatus = "active" | "pending" | "disabled";

export interface StaffMember {
  id: string; // Firebase Auth uid
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  perms: Perm[];
  createdAt: string;
}

export const STATUS_LABEL: Record<StaffStatus, string> = { active: "فعّال", pending: "بانتظار الموافقة", disabled: "موقوف" };

/** Who is using the system right now. */
export interface Me {
  uid: string;
  name: string;
  email: string;
  role: StaffRole;
  perms: Perm[];
  /** True while Firebase still has the old rules (staff records unreadable):
   *  everyone keeps full access until the new rules are published. */
  legacy?: boolean;
}

export function can(me: Me, p: Perm): boolean {
  return me.role === "owner" || me.perms.includes(p);
}

export const DEMO_ME: Me = { uid: "demo", name: "تجريبي", email: "", role: "owner", perms: [] };

export type MyAccess =
  | { kind: "ok"; me: Me }
  | { kind: "pending" | "disabled"; name: string }
  | { kind: "new"; ownerExists: boolean };

/** What the signed-in user may do. */
export async function loadMyAccess(uid: string, email: string): Promise<MyAccess> {
  try {
    const snap = await getDoc(doc(db!, "staff", uid));
    if (snap.exists()) {
      const s = snap.data() as Omit<StaffMember, "id">;
      if (s.status === "active") return { kind: "ok", me: { uid, name: s.name, email, role: s.role, perms: s.perms ?? [] } };
      return { kind: s.status === "pending" ? "pending" : "disabled", name: s.name };
    }
    const owner = await getDoc(doc(db!, "meta", "owner"));
    return { kind: "new", ownerExists: owner.exists() };
  } catch (e) {
    if ((e as { code?: string })?.code === "permission-denied") {
      return { kind: "ok", me: { uid, name: email.split("@")[0] || email, email, role: "owner", perms: [], legacy: true } };
    }
    throw e;
  }
}

/** The very first login becomes the owner (allowed once, by the rules). */
export async function claimOwner(uid: string, email: string, name: string) {
  const batch = writeBatch(db!);
  const rec: Omit<StaffMember, "id"> = { name, email, role: "owner", status: "active", perms: [], createdAt: new Date().toISOString() };
  batch.set(doc(db!, "staff", uid), rec);
  batch.set(doc(db!, "meta", "owner"), { uid, at: new Date().toISOString() });
  await batch.commit();
}

/** A login without a staff record asks the owner for access. */
export async function requestAccess(uid: string, email: string, name: string) {
  await saveDoc<StaffMember>("staff", { id: uid, name, email, role: "staff", status: "pending", perms: [], createdAt: new Date().toISOString() });
}

export async function getStaff(): Promise<StaffMember[]> {
  const list = await listDocs<StaffMember>("staff");
  return list.map((s) => ({ ...s, perms: s.perms ?? [] })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const saveStaff = (s: StaffMember) => saveDoc("staff", s);

/** Creates the login (email + password) for a new staff member without
 *  signing the owner out: a second, throw-away Firebase app does it. */
export async function createStaffAccount(input: { name: string; email: string; password: string; perms: Perm[] }): Promise<StaffMember> {
  if (!firebaseEnabled) throw new Error("Firebase غير مفعّل");
  const temp = initializeApp(firebaseConfig, `staff-create-${Date.now()}`);
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(temp), input.email.trim(), input.password);
    await signOut(getAuth(temp));
    const member: StaffMember = {
      id: cred.user.uid,
      name: input.name.trim(),
      email: input.email.trim(),
      role: "staff",
      status: "active",
      perms: input.perms,
      createdAt: new Date().toISOString(),
    };
    await saveStaff(member);
    return member;
  } finally {
    await deleteApp(temp).catch(() => undefined);
  }
}

export const STAFF_ERRORS: Record<string, string> = {
  "auth/email-already-in-use": "البريد ده عنده حساب. خلّي الموظف يسجّل دخول بيه — حيظهر عندك كطلب، وافق عليه.",
  "auth/weak-password": "كلمة المرور لازم 6 حروف أو أكتر.",
  "auth/invalid-email": "صيغة البريد غير صحيحة.",
  "auth/operation-not-allowed": "فعّل Email/Password في Firebase → Authentication.",
};
