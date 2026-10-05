"use client";

import { useEffect, useState } from "react";
import { Check, Clock, ExternalLink, Mail, Megaphone, RefreshCw, Save } from "lucide-react";
import WhatsAppIcon from "@/components/WhatsAppIcon";
import { getContactSettings, setContactSettings, type ContactSettings } from "@/lib/settings";
import { MESSAGES, waDigits, whatsappLink } from "@/lib/whatsapp";

function Field({
  icon,
  label,
  hint,
  error,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink">
        {icon} {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[11px] text-red-500">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-[11px] leading-relaxed text-subtle">{hint}</p>
      )}
    </div>
  );
}

export default function ContactTab({ onError }: { onError: (msg: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState<ContactSettings | null>(null);
  const [saved, setSaved] = useState<ContactSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    getContactSettings().then((c) => {
      setForm(c);
      setSaved(c);
      setLoaded(true);
    });
  }, []);

  if (!loaded || !form) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  const digits = waDigits(form.whatsapp);
  const numberError =
    digits.length === 0
      ? "رقم الواتساب مطلوب."
      : digits.length < 8 || digits.length > 15
      ? "الرقم لازم يكون كامل بمفتاح الدولة."
      : null;
  const channelError =
    form.channel && !/^https:\/\/(www\.)?(whatsapp\.com|chat\.whatsapp\.com|wa\.me)\//i.test(form.channel.trim())
      ? "الرابط لازم يبدأ بـ https://whatsapp.com/channel/…"
      : null;
  const emailError = form.email && !/^\S+@\S+\.\S+$/.test(form.email.trim()) ? "صيغة البريد غير صحيحة." : null;
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const canSave = dirty && !numberError && !channelError && !emailError && !saving;

  const set = (k: keyof ContactSettings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => (f ? { ...f, [k]: e.target.value } : f));

  async function save() {
    if (!form) return;
    const clean: ContactSettings = {
      whatsapp: form.whatsapp.trim(),
      channel: form.channel.trim(),
      email: form.email.trim(),
      hours: form.hours.trim(),
    };
    setSaving(true);
    try {
      await setContactSettings(clean);
      setForm(clean);
      setSaved(clean);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="card space-y-5 p-5">
        <div>
          <p className="text-sm font-bold text-ink">بيانات التواصل</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted">
            كل أزرار واتساب في الموقع (الحاسبة، الرئيسية، الزر العائم) بتفتح على الرقم ده. التغيير يظهر في الموقع خلال
            دقيقة.
          </p>
        </div>

        <Field
          icon={<WhatsAppIcon size={14} className="text-whatsapp" />}
          label="رقم واتساب للطلبات"
          hint="اكتبه بمفتاح الدولة (+256 أوغندا، +249 السودان…) — المسافات والشرطات عادي."
          error={numberError}
        >
          <div className="flex gap-2" dir="ltr">
            <input
              type="tel"
              inputMode="tel"
              value={form.whatsapp}
              onChange={set("whatsapp")}
              placeholder="+256 780 112 222"
              className="field flex-1 px-3.5 py-3 font-mono text-sm font-semibold"
            />
            <a
              href={numberError ? undefined : whatsappLink(MESSAGES.general, form.whatsapp)}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!!numberError}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 text-xs font-semibold text-ink shadow-soft ${
                numberError ? "pointer-events-none opacity-40" : "hover:border-whatsapp/60"
              }`}
            >
              <ExternalLink size={13} /> جرّب
            </a>
          </div>
        </Field>

        <Field
          icon={<Megaphone size={14} className="text-whatsapp" />}
          label="رابط قناة واتساب"
          hint="من واتساب: القناة ← مشاركة ← نسخ الرابط. اتركه فاضي لإخفاء زر القناة."
          error={channelError}
        >
          <div className="flex gap-2" dir="ltr">
            <input
              type="url"
              inputMode="url"
              value={form.channel}
              onChange={set("channel")}
              placeholder="https://whatsapp.com/channel/…"
              className="field flex-1 px-3.5 py-3 font-mono text-xs"
            />
            <a
              href={form.channel && !channelError ? form.channel : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!form.channel || !!channelError}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 text-xs font-semibold text-ink shadow-soft ${
                !form.channel || channelError ? "pointer-events-none opacity-40" : "hover:border-whatsapp/60"
              }`}
            >
              <ExternalLink size={13} /> افتح
            </a>
          </div>
        </Field>

        <Field
          icon={<Mail size={14} className="text-primary" />}
          label="البريد الإلكتروني"
          hint="اتركه فاضي لإخفائه من الموقع."
          error={emailError}
        >
          <input
            type="email"
            value={form.email}
            onChange={set("email")}
            placeholder="info@example.com"
            dir="ltr"
            className="field px-3.5 py-3 font-mono text-sm"
          />
        </Field>

        <Field icon={<Clock size={14} className="text-primary" />} label="ساعات العمل" hint="اتركها فاضية لإخفائها.">
          <input
            type="text"
            value={form.hours}
            onChange={set("hours")}
            placeholder="خدمة عملاء على مدار اليوم"
            className="field px-3.5 py-3 text-sm"
          />
        </Field>

        <button onClick={save} disabled={!canSave} className="btn-primary w-full py-3.5 text-sm">
          {justSaved ? <Check size={16} /> : <Save size={16} />}
          {saving ? "جارٍ الحفظ…" : justSaved ? "تم الحفظ" : dirty ? "حفظ التغييرات" : "محفوظ"}
        </button>
      </div>

      {/* Preview of how it appears */}
      <div className="card-sm p-4">
        <p className="mb-3 text-[11px] font-semibold text-subtle">معاينة في الموقع</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-whatsapp/30 bg-whatsapp/10 p-3">
            <span className="rounded-lg bg-whatsapp p-2 text-white">
              <WhatsAppIcon size={16} />
            </span>
            <div>
              <p className="text-xs font-semibold text-ink">واتساب — أسرع طريقة</p>
              <p className="font-mono text-xs text-muted" dir="ltr">
                {form.whatsapp || "—"}
              </p>
            </div>
          </div>
          {form.channel && !channelError && (
            <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-surface2 p-3">
              <span className="rounded-lg bg-whatsapp/15 p-2 text-whatsapp">
                <Megaphone size={16} />
              </span>
              <p className="text-xs font-semibold text-ink">قناتنا على واتساب</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
