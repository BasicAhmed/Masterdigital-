"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";
import { FEEDBACK_LABEL, saveFeedback, type FeedbackType } from "@/lib/alerts";
import { newId } from "@/lib/store";

/** Suggestions, complaints and problem reports, sent straight to the team. */
export default function Suggestions() {
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = message.trim().length >= 5;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await saveFeedback({
        id: newId(),
        type,
        name: name.trim().slice(0, 80),
        contact: contact.trim().slice(0, 120),
        message: message.trim().slice(0, 2000),
        status: "new",
        reply: "",
        createdAt: new Date().toISOString(),
      });
      setSent(true);
      setMessage("");
    } catch {
      setError("تعذر الإرسال. جرّب تاني بعد شوية أو راسلنا على واتساب.");
    }
    setBusy(false);
  }

  return (
    <section id="feedback" className="border-t border-border bg-surface py-16 sm:py-24">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
        <div>
          <h2 className="section-heading">اقتراحات وشكاوى</h2>
          <p className="mt-4 max-w-md leading-loose text-muted">
            عندك اقتراح، ملاحظة، شكوى أو واجهتك مشكلة؟ اكتبها هنا وتوصل الإدارة مباشرة. لو عاوز نرد عليك اكتب رقمك أو
            بريدك.
          </p>
        </div>

        {sent ? (
          <div className="card flex flex-col items-center p-8 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
              <Check size={26} />
            </span>
            <p className="mt-4 font-display text-lg font-bold text-ink">وصلتنا رسالتك</p>
            <p className="mt-2 text-sm text-muted">شكراً ليك — الإدارة حتراجعها.</p>
            <button onClick={() => setSent(false)} className="btn-ghost mt-6 px-6 py-2.5 text-sm">
              إرسال رسالة تانية
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface2 p-1" role="group" aria-label="نوع الرسالة">
              {(Object.keys(FEEDBACK_LABEL) as FeedbackType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  aria-pressed={type === t}
                  className={`rounded-lg py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                    type === t ? "bg-brand-navy text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {FEEDBACK_LABEL[t]}
                </button>
              ))}
            </div>
            <label className="block">
              <span className="label">رسالتك *</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                maxLength={2000}
                required
                className="field px-3.5 py-3 text-sm leading-relaxed"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="label">الاسم (اختياري)</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="field px-3.5 py-2.5 text-sm" />
              </label>
              <label className="block">
                <span className="label">واتساب أو بريد للرد (اختياري)</span>
                <input value={contact} onChange={(e) => setContact(e.target.value)} dir="ltr" maxLength={120} className="field px-3.5 py-2.5 text-sm" />
              </label>
            </div>
            {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}
            <button disabled={!valid || busy} className="btn-primary w-full py-3.5 text-sm">
              <Send size={16} /> {busy ? "جارٍ الإرسال…" : "إرسال"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
