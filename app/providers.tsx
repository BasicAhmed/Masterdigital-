"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";

/** Once per visit, ask the server whether an automatic price update is due.
 *  The server decides (owner's mode + interval), so this never forces one.
 *  Runs after the page is idle so it never slows the first paint. */
function useRatesTick() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("ratesTick")) return;
    } catch {
      /* private mode: just ping */
    }
    const ping = () => {
      try {
        sessionStorage.setItem("ratesTick", "1");
      } catch {}
      fetch("/api/rates/tick", { method: "POST", keepalive: true }).catch(() => {});
    };
    const t = window.setTimeout(ping, 4000);
    return () => window.clearTimeout(t);
  }, []);
}

export default function Providers({ children }: { children: React.ReactNode }) {
  useRatesTick();
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      {children}
    </ThemeProvider>
  );
}
