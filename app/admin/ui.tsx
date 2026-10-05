"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cleanNumber, formatTyping } from "@/lib/format";
import { STATUS_LABEL, type TxStatus } from "@/lib/data";
import { CURRENCIES, type CurrencyCode } from "@/lib/currencies";

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-[#06163a]/70" onClick={onClose} />
      <div
        className={`relative flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-3xl border border-border/70 bg-surface shadow-lift sm:rounded-3xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="font-display text-base font-bold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق" className="rounded-full p-1.5 text-subtle transition-colors hover:bg-surface2 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/** Numeric text input with thousands separators while typing. */
export function NumInput({
  value,
  onChange,
  suffix,
  decimals = 4,
  placeholder,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  decimals?: number;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className="relative" dir="ltr">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={formatTyping(value)}
        onChange={(e) => onChange(cleanNumber(e.target.value, decimals))}
        onFocus={(e) => e.currentTarget.select()}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`field py-2.5 pl-3.5 text-left font-mono text-sm font-semibold ${suffix ? "pr-14" : "pr-3.5"} ${className}`}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center font-mono text-[11px] font-semibold text-subtle">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] leading-relaxed text-subtle">{hint}</span>}
    </label>
  );
}

const STATUS_TONE: Record<TxStatus, string> = {
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  cancelled: "bg-red-500/15 text-red-600 dark:text-red-400",
};

export function StatusChip({ status }: { status: TxStatus }) {
  return <span className={`chip ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>;
}

export function RouteTag({ from, to }: { from: CurrencyCode; to: CurrencyCode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap font-mono text-xs font-semibold text-ink" dir="ltr">
      <span>{CURRENCIES[from]?.flag}</span>
      {from}
      <span className="text-subtle">→</span>
      <span>{CURRENCIES[to]?.flag}</span>
      {to}
    </span>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="card-sm flex flex-col items-center px-6 py-12 text-center">
      <p className="font-display text-base font-bold text-ink">{title}</p>
      {hint && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "primary" | "good" | "gold";
}) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    good: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    gold: "bg-accent/15 text-accent",
  };
  return (
    <div className="card-sm p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && <span className={`rounded-lg p-1.5 ${tones[tone]}`}>{icon}</span>}
      </div>
      <p className="num mt-2 text-[1.65rem] font-bold tracking-tight text-ink" dir="ltr">
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] text-subtle">{sub}</p>}
    </div>
  );
}

/** Ranked horizontal bars — one measure, one hue; the value is written out
 *  beside every bar so nothing depends on reading bar length alone. */
export function RankBars({
  rows,
  empty = "لا توجد بيانات في هذه الفترة.",
}: {
  rows: { key: string; label: React.ReactNode; value: number; display: string; sub?: string }[];
  empty?: string;
}) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-subtle">{empty}</p>;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1e-9);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-ink">{r.label}</span>
            <span className="num shrink-0 font-semibold text-ink" dir="ltr">
              {r.display}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
              <div
                className={`h-full rounded-full ${r.value < 0 ? "bg-red-500" : "bg-primary"}`}
                style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%` }}
              />
            </div>
            {r.sub && <span className="w-24 shrink-0 text-left text-[11px] text-subtle">{r.sub}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card-sm p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-bold text-ink">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
