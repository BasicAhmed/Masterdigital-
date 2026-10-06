"use client";

import { useState } from "react";
import { BellRing, Check, Star } from "lucide-react";
import { CURRENCIES, type CurrencyCode } from "@/lib/corridors";
import { formatRate } from "@/lib/format";
import { useFavorites } from "@/lib/favorites";
import { higherIsBetter, saveAlert } from "@/lib/alerts";
import { newId } from "@/lib/store";
import { waDigits } from "@/lib/whatsapp";
import { Field, Modal, NumInput } from "@/app/admin/ui";

/** Star button for one route. Saved on the visitor's device. */
export function FavoriteStar({ from, to, className = "" }: { from: string; to: string; className?: string }) {
  const { isFavorite, toggle } = useFavorites();
  const key = `${from}_${to}`;
  const on = isFavorite(key);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        toggle(key);
      }}
      aria-pressed={on}
      aria-label={on ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      title={on ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      className={`rounded-lg p-1.5 transition-colors ${on ? "text-brand-gold" : "text-subtle hover:text-brand-gold"} ${className}`}
    >
      <Star size={16} fill={on ? "currentColor" : "none"} />
    </button>
  );
}

function AlertForm({
  from,
  to,
  rate,
  multiply,
  onClose,
}: {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  multiply: boolean;
  onClose: () => void;
}) {
  const [target, setTarget] = useState(String(rate));
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The rate is shown the same way the calculator shows it.
  const [one, other] = multiply ? [from, to] : [to, from];
  const better = higherIsBetter(from, to);
  const t = parseFloat(target) || 0;
  const digits = waDigits(whatsapp);
  const emailOk = !email.trim() || /^\S+@\S+\.\S+$/.test(email.trim());
  const alreadyThere = t > 0 && (better ? rate >= t : rate <= t);
  const valid = t > 0 && digits.length >= 8 && digits.length <= 15 && emailOk && !alreadyThere;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await saveAlert({
        id: newId(),
        from,
        to,
        target: t,
        rateAtCreation: rate,
        name: name.trim().slice(0, 80),
        whatsapp: whatsapp.trim().slice(0, 30),
        email: email.trim().slice(0, 120),
        status: "active",
        createdAt: new Date().toISOString(),
        reachedAt: "",
        reachedRate: 0,
      });
      setDone(true);
    } catch {
      setError("تعذر حفظ التنبيه. جرّب تاني بعد شوية أو راسلنا على واتساب.");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <Modal title="تم تسجيل التنبيه" onClose={onClose}>
        <div className="flex flex-col items-center py-4 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Check size={26} />
          </span>
          <p className="mt-4 font-display text-lg font-bold text-ink">حنبلغك أول ما السعر يوصل</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
            لما سعر {CURRENCIES[from].currency} إلى {CURRENCIES[to].currency} يوصل{" "}
            <b className="num text-ink" dir="ltr">
              {formatRate(t)}
            </b>{" "}
            حنتواصل معاك على واتساب{email.trim() ? " والبريد" : ""}.
          </p>
          <button onClick={onClose} className="btn-primary mt-6 px-8 py-3 text-sm">
            تمام
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="تنبيه السعر" onClose={onClose}>
      <div className="space-y-4">
        <p className="rounded-xl bg-surface2 p-3 text-sm text-muted">
          السعر الآن:{" "}
          <b className="num text-ink" dir="ltr">
            1 {one} = {formatRate(rate)} {other}
          </b>
          <span className="mt-1 block text-xs">
            حننبهك لما السعر {better ? "يرتفع إلى" : "ينزل إلى"} الرقم اللي تكتبه — يعني لما يبقى أحسن ليك.
          </span>
        </p>

        <Field label={`السعر المطلوب (1 ${one} = ؟ ${other})`}>
          <NumInput value={target} onChange={setTarget} suffix={other} ariaLabel="السعر المطلوب" className="text-base" />
        </Field>
        {alreadyThere && (
          <p className="text-xs font-semibold text-amber-600">
            السعر الحالي واصل الرقم ده بالفعل — اكتب سعر {better ? "أعلى" : "أقل"} من السعر الحالي.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="الاسم">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="field px-3 py-2.5 text-sm" />
          </Field>
          <Field label="رقم واتساب *" hint="بمفتاح الدولة، مثال: +256 780 112 222">
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              dir="ltr"
              inputMode="tel"
              maxLength={30}
              className="field px-3 py-2.5 font-mono text-sm"
            />
          </Field>
        </div>
        <Field label="البريد الإلكتروني (اختياري)" hint="لو كتبته حيوصلك التنبيه على البريد كمان.">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            maxLength={120}
            className="field px-3 py-2.5 font-mono text-sm"
          />
        </Field>
        {!emailOk && <p className="text-xs text-red-500">صيغة البريد غير صحيحة.</p>}
        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}

        <button onClick={submit} disabled={!valid || busy} className="btn-primary w-full py-3.5 text-sm">
          <BellRing size={16} /> {busy ? "جارٍ الحفظ…" : "فعّل التنبيه"}
        </button>
      </div>
    </Modal>
  );
}

/** The two personal tools under the calculator: favourite this route, and
 *  ask to be told when it reaches a target rate. */
export default function CalcExtras({
  from,
  to,
  rate,
  multiply,
}: {
  from: CurrencyCode;
  to: CurrencyCode;
  rate?: number;
  multiply: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { isFavorite, toggle } = useFavorites();
  const key = `${from}_${to}`;
  const fav = isFavorite(key);

  return (
    <>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={!rate}
          className="btn-ghost py-2.5 text-xs disabled:opacity-40"
        >
          <BellRing size={14} className="text-primary" /> نبّهني عند سعر معيّن
        </button>
        <button type="button" onClick={() => toggle(key)} aria-pressed={fav} className="btn-ghost py-2.5 text-xs">
          <Star size={14} className="text-brand-gold" fill={fav ? "currentColor" : "none"} />
          {fav ? "في المفضلة" : "أضف للمفضلة"}
        </button>
      </div>
      {open && rate && <AlertForm from={from} to={to} rate={rate} multiply={multiply} onClose={() => setOpen(false)} />}
    </>
  );
}
