"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { Check, Clock, Crown, LogOut, Ban } from "lucide-react";
import { claimOwner, requestAccess, type MyAccess } from "@/lib/staff";

function Shell({ children, onSignOut }: { children: ReactNode; onSignOut: () => void }) {
  return (
    <div className="navy-field relative flex min-h-screen items-center justify-center overflow-hidden px-5">
      <div aria-hidden="true" className="shield-lines pointer-events-none absolute inset-0" />
      <div className="calc-card relative w-full max-w-sm p-6 text-center sm:p-8">
        <div className="logo-tile mx-auto size-16 rounded-2xl">
          <Image src="/logo.png" alt="Master Digital" width={128} height={128} className="h-full w-full object-contain" priority />
        </div>
        {children}
        <button onClick={onSignOut} className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
          <LogOut size={13} /> تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

/** Shown after login when this person can't use the system yet. */
export default function AccessScreen({
  access,
  uid,
  email,
  onDone,
  onSignOut,
}: {
  access: Exclude<MyAccess, { kind: "ok" }>;
  uid: string;
  email: string;
  onDone: () => void;
  onSignOut: () => void;
}) {
  const [name, setName] = useState(email.split("@")[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (access.kind === "pending" || access.kind === "disabled") {
    const pending = access.kind === "pending";
    return (
      <Shell onSignOut={onSignOut}>
        <span className={`mx-auto mt-5 flex size-11 items-center justify-center rounded-full ${pending ? "bg-amber-500/15 text-amber-500" : "bg-red-500/10 text-red-500"}`}>
          {pending ? <Clock size={20} /> : <Ban size={20} />}
        </span>
        <h1 className="mt-3 font-display text-lg font-bold text-ink">{pending ? "طلبك وصل للمالك" : "حسابك موقوف"}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {pending ? `أهلاً ${access.name}. أول ما المالك يوافق ويحدد صلاحياتك، تقدر تدخل.` : "تواصل مع المالك لو دي غلطة."}
        </p>
        {pending && (
          <button onClick={onDone} className="btn-ghost mt-5 w-full py-3 text-sm">
            تحقق مرة تانية
          </button>
        )}
      </Shell>
    );
  }

  const owner = access.kind === "new" && !access.ownerExists;
  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      if (owner) await claimOwner(uid, email, name.trim());
      else await requestAccess(uid, email, name.trim());
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Shell onSignOut={onSignOut}>
      <span className="mx-auto mt-5 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        {owner ? <Crown size={20} /> : <Clock size={20} />}
      </span>
      <h1 className="mt-3 font-display text-lg font-bold text-ink">{owner ? "إعداد حساب المالك" : "طلب دخول"}</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        {owner
          ? "إنت أول شخص يدخل — حتبقى المالك، بكل الصلاحيات، والوحيد اللي يضيف الموظفين ويحدد صلاحياتهم."
          : "الحساب ده لسه ما عنده صلاحيات. اكتب اسمك وابعت الطلب للمالك."}
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="الاسم اللي حيظهر في السجل"
        className="field mt-5 px-3.5 py-3 text-sm"
      />
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <button onClick={submit} disabled={!name.trim() || busy} className="btn-primary mt-3 w-full py-3.5 text-sm">
        <Check size={16} /> {busy ? "…" : owner ? "أنا المالك — ابدأ" : "إرسال الطلب"}
      </button>
    </Shell>
  );
}
