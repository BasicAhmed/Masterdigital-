"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { RefreshCw } from "lucide-react";
import { auth, firebaseEnabled } from "@/lib/firebase";
import AdminLogin from "./Login";
import AdminApp from "./AdminApp";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!firebaseEnabled || !auth) {
      setChecking(false);
      return;
    }
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
    });
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <RefreshCw size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  // No Firebase yet → demo mode: the whole system works, data stays in this browser.
  if (!firebaseEnabled) return <AdminApp />;
  if (!user) return <AdminLogin />;
  return <AdminApp onSignOut={() => signOut(auth!)} userEmail={user.email ?? undefined} />;
}
