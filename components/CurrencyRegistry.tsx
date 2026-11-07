"use client";

import { registerCurrencies, type CustomCurrency } from "@/lib/corridors";

/** Adds the owner's currencies on the browser side before any child renders
 *  (the server already registered the same list when it built the page). */
export default function CurrencyRegistry({ list, children }: { list: CustomCurrency[]; children: React.ReactNode }) {
  registerCurrencies(list);
  return <>{children}</>;
}
