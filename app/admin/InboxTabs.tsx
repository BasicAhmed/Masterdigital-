"use client";

import { useMemo, useState } from "react";
import { BellRing, Check, MessageSquareText, Trash2 } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { CURRENCIES } from "@/lib/corridors";
import { isMultiplyCorridor } from "@/lib/corridors";
import { formatRate } from "@/lib/format";
import { formatRelativeTime } from "@/lib/relativeTime";
import { ALERT_STATUS_LABEL, FEEDBACK_LABEL, higherIsBetter, type AlertStatus, type Feedback, type RateAlert } from "@/lib/alerts";
import { waDigits, whatsappLink } from "@/lib/whatsapp";
import type { AdminData } from "./AdminApp";
import { Empty, RouteTag } from "./ui";

const ALERT_TONE: Record<AlertStatus, string> = {
  active: "bg-surface2 text-muted",
  reached: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  notified: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

function alertMessage(a: RateAlert, rate: number): string {
  const [one, other] = isMultiplyCorridor(a.from, a.to) ? [a.from, a.to] : [a.to, a.from];
  return [
    `السلام عليكم${a.name ? ` ${a.name}` : ""} 👋`,
    `السعر اللي طلبت تنبيه عليه وصل في Master Digital:`,
    "",
    `🔁 ${CURRENCIES[a.from].currency} ← ${CURRENCIES[a.to].currency}`,
    `📊 السعر الآن: ‎1 ${one} = ${formatRate(rate)} ${other}‎`,
    `🎯 السعر المطلوب: ‎${formatRate(a.target)}‎`,
    "",
    "لو عاوز تحوّل هسه رد علينا ونكمل ليك الطلب 🙏",
  ].join("\n");
}

export function AlertsTab({ data }: { data: AdminData }) {
  const { alerts, routes } = data;
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const rateOf = (a: RateAlert) => routes.find((r) => r.from === a.from && r.to === a.to)?.rate ?? 0;
  const order: Record<AlertStatus, number> = { reached: 0, active: 1, notified: 2 };
  const list = useMemo(
    () => [...alerts].sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt)),
    [alerts] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const reached = alerts.filter((a) => a.status === "reached").length;

  if (alerts.length === 0) {
    return (
      <Empty
        title="لسه ما في تنبيهات أسعار"
        hint="العملاء يسجلوا تنبيه من الحاسبة في الموقع: يختاروا المسار والسعر المطلوب. لما السعر يوصل، التنبيه يظهر هنا جاهز للإرسال."
      />
    );
  }

  return (
    <div className="space-y-4">
      <p className="rounded-2xl border border-border bg-surface2/60 p-3.5 text-xs leading-relaxed text-muted">
        <b className="text-ink">كيف يشتغل:</b> مع كل تحديث للأسعار النظام يراجع التنبيهات. اللي وصل سعره يتحول لـ «وصل السعر» —
        اضغط زر واتساب والرسالة جاهزة للعميل. العملاء اللي كتبوا بريدهم يوصلهم بريد تلقائي لو خدمة البريد مفعّلة.
      </p>
      {reached > 0 && (
        <p className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm font-semibold text-ink">
          <BellRing size={16} className="text-amber-500" /> {reached} تنبيه وصل سعره ومنتظر الإبلاغ
        </p>
      )}
      <ul className="grid gap-3 lg:grid-cols-2">
        {list.map((a) => {
          const now = rateOf(a);
          const [one, other] = isMultiplyCorridor(a.from, a.to) ? [a.from, a.to] : [a.to, a.from];
          const gap = a.target ? ((now - a.target) / a.target) * 100 * (higherIsBetter(a.from, a.to) ? -1 : 1) : 0;
          return (
            <li key={a.id} className={`card-sm p-4 ${a.status === "reached" ? "ring-1 ring-amber-500/50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{a.name || "بدون اسم"}</p>
                  <p className="num text-xs text-subtle" dir="ltr">{a.whatsapp}{a.email ? `  ${a.email}` : ""}</p>
                </div>
                <span className={`chip shrink-0 ${ALERT_TONE[a.status]}`}>{ALERT_STATUS_LABEL[a.status]}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <RouteTag from={a.from} to={a.to} />
                  <p className="num mt-1 text-sm text-muted" dir="ltr">
                    1 {one} = <b className="text-ink">{formatRate(a.target)}</b> {other}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-[11px] text-subtle">السعر الآن</p>
                  <p className="num text-sm font-bold text-ink" dir="ltr">{formatRate(now)}</p>
                  {a.status === "active" && now > 0 && (
                    <p className="num text-[11px] text-subtle" dir="ltr">باقي {Math.abs(gap).toFixed(2)}%</p>
                  )}
                </div>
              </div>
              <p className="mt-2 text-[11px] text-subtle">
                سُجّل {formatRelativeTime(a.createdAt)}
                {a.reachedAt && ` — وصل ${formatRelativeTime(a.reachedAt)}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {waDigits(a.whatsapp) && (
                  <a
                    href={whatsappLink(alertMessage(a, now), a.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => a.status === "reached" && data.upsertAlert({ ...a, status: "notified" })}
                    className="btn-whatsapp px-3.5 py-2 text-xs"
                  >
                    <WhatsAppIcon size={14} /> بلّغ العميل
                  </a>
                )}
                {a.status === "reached" && (
                  <button onClick={() => data.upsertAlert({ ...a, status: "notified" })} className="btn-ghost px-3.5 py-2 text-xs">
                    <Check size={13} /> تم الإبلاغ
                  </button>
                )}
                {confirmId === a.id ? (
                  <button onClick={() => data.removeAlert(a.id)} className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white">تأكيد الحذف</button>
                ) : (
                  <button onClick={() => setConfirmId(a.id)} className="btn-ghost px-3.5 py-2 text-xs text-red-500">
                    <Trash2 size={13} /> حذف
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FeedbackTab({ data }: { data: AdminData }) {
  const { feedback } = data;
  const [filter, setFilter] = useState<"new" | "handled" | "all">("new");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const list = useMemo(
    () => feedback.filter((f) => filter === "all" || f.status === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [feedback, filter]
  );
  const isPhone = (f: Feedback) => !f.contact.includes("@") && waDigits(f.contact).length >= 8;

  if (feedback.length === 0) {
    return <Empty title="لسه ما في رسائل" hint="الاقتراحات والشكاوى وبلاغات المشاكل اللي يرسلها العملاء من الموقع تظهر هنا." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="تصفية">
        {(
          [
            ["new", `جديدة (${feedback.filter((f) => f.status === "new").length})`],
            ["handled", "تمت معالجتها"],
            ["all", "الكل"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold ${filter === k ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty title="لا توجد رسائل في التصفية دي" />
      ) : (
        <ul className="space-y-3">
          {list.map((f) => (
            <li key={f.id} className="card-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2">
                  <span className={`chip ${f.type === "suggestion" ? "bg-primary/10 text-primary" : f.type === "complaint" ? "bg-red-500/15 text-red-600 dark:text-red-400" : "bg-amber-500/15 text-amber-600 dark:text-amber-400"}`}>
                    <MessageSquareText size={11} /> {FEEDBACK_LABEL[f.type]}
                  </span>
                  <span className="text-sm font-semibold text-ink">{f.name || "بدون اسم"}</span>
                </p>
                <span className="shrink-0 text-[11px] text-subtle">{formatRelativeTime(f.createdAt)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">{f.message}</p>
              {f.contact && <p className="num mt-2 text-xs text-muted" dir="ltr">{f.contact}</p>}
              {f.status === "handled" ? (
                <p className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-xs text-ink">
                  <b className="text-emerald-600 dark:text-emerald-400">تمت المعالجة</b>
                  {f.reply && ` — ${f.reply}`}
                </p>
              ) : (
                <input
                  value={notes[f.id] ?? ""}
                  onChange={(e) => setNotes({ ...notes, [f.id]: e.target.value })}
                  placeholder="ملاحظة عن المعالجة (اختياري)"
                  className="field mt-3 px-3 py-2.5 text-sm"
                />
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {f.status === "new" ? (
                  <button onClick={() => data.upsertFeedback({ ...f, status: "handled", reply: (notes[f.id] ?? "").trim() })} className="btn-primary px-3.5 py-2 text-xs">
                    <Check size={13} /> تمت المعالجة
                  </button>
                ) : (
                  <button onClick={() => data.upsertFeedback({ ...f, status: "new" })} className="btn-ghost px-3.5 py-2 text-xs">إعادة فتح</button>
                )}
                {isPhone(f) && (
                  <a href={whatsappLink(`السلام عليكم${f.name ? ` ${f.name}` : ""} 👋\nبخصوص رسالتك لـ Master Digital:`, f.contact)} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-3.5 py-2 text-xs">
                    <WhatsAppIcon size={14} /> رد واتساب
                  </a>
                )}
                {f.contact.includes("@") && (
                  <a href={`mailto:${f.contact}`} className="btn-ghost px-3.5 py-2 text-xs">رد بالبريد</a>
                )}
                {confirmId === f.id ? (
                  <button onClick={() => data.removeFeedback(f.id)} className="rounded-xl bg-red-600 px-3.5 py-2 text-xs font-semibold text-white">تأكيد الحذف</button>
                ) : (
                  <button onClick={() => setConfirmId(f.id)} className="btn-ghost px-3.5 py-2 text-xs text-red-500">
                    <Trash2 size={13} /> حذف
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
