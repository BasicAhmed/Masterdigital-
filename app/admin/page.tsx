"use client";

import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { RefreshCw } from "lucide-react";
import { auth, firebaseEnabled } from "@/lib/firebase";
import { DEMO_ME, loadMyAccess, type MyAccess } from "@/lib/staff";
import AdminLogin from "./Login";
import AdminApp from "./AdminApp";
import AccessScreen from "./Access";

function Spinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <RefreshCw size={20} className="animate-spin text-primary" />
    </div>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [access, setAccess] = useState<MyAccess | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setChecking(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAccess(null);
      setChecking(false);
    });
  }, []);

  const check = useCallback(() => {
    if (!user) return;
    setAccess(null);
    setError("");
    loadMyAccess(user.uid, user.email ?? "")
      .then(setAccess)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [user]);

  useEffect(check, [check]);

  const out = () => signOut(auth!);

  if (checking) return <Spinner />;
  // No Firebase yet → demo mode: the whole system works, data stays in this browser.
  if (!firebaseEnabled) return <AdminApp me={DEMO_ME} />;
  if (!user) return <AdminLogin />;
  if (error)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-red-500">تعذر تحميل الصلاحيات: {error}</p>
        <button onClick={check} className="btn-ghost px-5 py-2.5 text-sm">
          حاول تاني
        </button>
      </div>
    );
  if (!access) return <Spinner />;
  if (access.kind !== "ok")
    return <AccessScreen access={access} uid={user.uid} email={user.email ?? ""} onDone={check} onSignOut={out} />;
  return <AdminApp me={access.me} onSignOut={out} />;
}
