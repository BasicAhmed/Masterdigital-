"use client";

import { useMemo, useState } from "react";
import { Ban, Check, Crown, Download, KeyRound, Pencil, Search, Trophy, UserPlus } from "lucide-react";
import { downloadCsv } from "@/lib/data";
import { fmtUsd, todayStr } from "@/lib/format";
import { PERIODS, periodRange, type PeriodKey } from "@/lib/stats";
import { ACTION_TONE, KIND_LABEL, logActivity, type ActivityKind } from "@/lib/activity";
import {
  createStaffAccount,
  PERMS,
  PRESETS,
  saveStaff,
  STAFF_ERRORS,
  STATUS_LABEL,
  type Perm,
  type StaffMember,
} from "@/lib/staff";
import { demoMode } from "@/lib/store";
import type { AdminData } from "./AdminApp";
import { Empty, Field, Modal, Panel } from "./ui";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const STATUS_TONE = {
  active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  disabled: "bg-red-500/10 text-red-500",
} as const;

/* ------------------------------ performance ------------------------------ */

interface Row {
  uid: string;
  name: string;
  deals: number;
  volume: number;
  profit: number;
  customers: number;
  actions: number;
  lastSeen: string | null;
}

function Performance({ data }: { data: AdminData }) {
  const [period, setPeriod] = useState<PeriodKey>("month");
  const money = data.can("finance");
  const range = periodRange(period);
  const inRange = (day: string) => day >= range.from && day <= range.to;

  const rows = useMemo(() => {
    const map = new Map<string, Row>();
    const row = (uid: string, name?: string) => {
      if (!map.has(uid)) map.set(uid, { uid, name: name || "غير معروف", deals: 0, volume: 0, profit: 0, customers: 0, actions: 0, lastSeen: null });
      const r = map.get(uid)!;
      if (name && r.name === "غير معروف") r.name = name;
      return r;
    };
    for (const s of data.staff) if (s.status === "active") row(s.id, s.name);
    for (const t of data.txs) {
      if (!t.createdBy || t.status !== "completed" || !inRange(t.date)) continue;
      const r = row(t.createdBy, t.createdByName);
      r.deals++;
      r.volume += t.volumeUsd;
      r.profit += t.profitUsd;
    }
    for (const c of data.customers) {
      if (!c.createdBy || !inRange(c.createdAt.slice(0, 10))) continue;
      row(c.createdBy, c.createdByName).customers++;
    }
    for (const a of data.activity) {
      const r = row(a.uid, a.name);
      if (!r.lastSeen || a.at > r.lastSeen) r.lastSeen = a.at;
      if (inRange(a.at.slice(0, 10))) r.actions++;
    }
    // names from the staff list win (they're the current ones)
    for (const s of data.staff) if (map.has(s.id)) map.get(s.id)!.name = s.name;
    return Array.from(map.values()).sort((a, b) => b.deals - a.deals || b.volume - a.volume || b.actions - a.actions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.staff, data.txs, data.customers, data.activity, range.from, range.to]);

  const best = rows[0] && rows[0].deals > 0 ? rows[0] : null;
  const maxDeals = Math.max(1, ...rows.map((r) => r.deals));
  const medal = (i: number, r: Row) => (r.deals > 0 ? ["🥇", "🥈", "🥉"][i] ?? "" : "");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="الفترة">
        {PERIODS.filter(([k]) => k !== "custom").map(([k, label]) => (
          <button
            key={k}
            onClick={() => setPeriod(k)}
            aria-pressed={period === k}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              period === k ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {best && (
        <div className="navy-field on-navy relative overflow-hidden rounded-2xl p-5" style={{ boxShadow: "inset 0 2px 0 #c9a227" }}>
          <p className="flex items-center gap-2 text-xs font-medium text-white/75">
            <Trophy size={14} className="text-brand-gold" /> أفضل موظف في الفترة
          </p>
          <p className="mt-1 font-display text-2xl font-extrabold">{best.name}</p>
          <p className="mt-1 text-sm text-white/80">
            <b className="num">{best.deals}</b> معاملة مكتملة
            {money && (
              <>
                {" · "}حجم <b className="num" dir="ltr">{fmtUsd(best.volume)}</b> · ربح <b className="num" dir="ltr">{fmtUsd(best.profit)}</b>
              </>
            )}
          </p>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty title="لسه ما في نشاط" hint="أول ما الفريق يبدأ يسجّل معاملات، الترتيب حيظهر هنا." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.uid} className="card-sm p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                  <span className="w-6 text-center text-lg">{medal(i, r) || <span className="num text-xs text-subtle">{i + 1}</span>}</span>
                  <span className="truncate">{r.name}</span>
                </p>
                <p className="text-[11px] text-subtle">{r.lastSeen ? `آخر نشاط ${when(r.lastSeen)}` : "ما في نشاط"}</p>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface2">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(r.deals / maxDeals) * 100}%` }} />
              </div>
              <div className={`mt-2.5 grid gap-2 text-center text-xs ${money ? "grid-cols-5" : "grid-cols-3"}`}>
                {(
                  [
                    ["معاملات", String(r.deals)],
                    ...(money ? [["الحجم", fmtUsd(r.volume)], ["الربح", fmtUsd(r.profit)]] : []),
                    ["عملاء جدد", String(r.customers)],
                    ["إجراءات", String(r.actions)],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-surface2 px-1 py-2">
                    <p className="text-[10px] text-subtle">{label}</p>
                    <p className="num mt-0.5 font-bold text-ink" dir="ltr">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] leading-relaxed text-subtle">
        الترتيب بعدد المعاملات المكتملة اللي سجلها كل موظف في الفترة. المعاملات القديمة قبل نظام الفريق ما عندها اسم، فما بتتحسب.
      </p>
    </div>
  );
}

/* ------------------------------ activity log ------------------------------ */

function ActivityLog({ data }: { data: AdminData }) {
  const [who, setWho] = useState("ALL");
  const [kind, setKind] = useState<ActivityKind | "ALL">("ALL");
  const [q, setQ] = useState("");
  const people = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of data.activity) if (!m.has(a.uid)) m.set(a.uid, a.name);
    for (const s of data.staff) m.set(s.id, s.name);
    return Array.from(m.entries());
  }, [data.activity, data.staff]);

  const list = data.activity.filter(
    (a) => (who === "ALL" || a.uid === who) && (kind === "ALL" || a.kind === kind) && (!q.trim() || a.summary.includes(q.trim()) || a.name.includes(q.trim()))
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث في السجل…" className="field py-2.5 pl-3 pr-9 text-sm" />
        </div>
        <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="الموظف" className="field w-40 px-3 py-2.5 text-xs font-semibold">
          <option value="ALL">كل الفريق</option>
          {people.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as ActivityKind | "ALL")} aria-label="النوع" className="field w-32 px-3 py-2.5 text-xs font-semibold">
          <option value="ALL">كل الأنواع</option>
          {(Object.keys(KIND_LABEL) as ActivityKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            downloadCsv(`master-digital-activity-${todayStr()}.csv`, [
              ["الوقت", "الموظف", "النوع", "الإجراء"],
              ...list.map((a) => [a.at.replace("T", " ").slice(0, 19), a.name, KIND_LABEL[a.kind], a.summary]),
            ])
          }
          disabled={!list.length}
          className="btn-ghost px-4 py-2.5 text-xs disabled:opacity-40"
        >
          <Download size={14} /> تصدير
        </button>
      </div>

      {list.length === 0 ? (
        <Empty title="ما في نشاط مسجّل" hint="كل إضافة، تعديل أو حذف حتظهر هنا باسم اللي عملها." />
      ) : (
        <ul className="card-sm divide-y divide-border/50 p-0">
          {list.slice(0, 300).map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className={`text-sm font-medium ${ACTION_TONE[a.action]}`}>{a.summary}</p>
                <p className="mt-0.5 text-[11px] text-subtle">
                  <b className="text-muted">{a.name}</b> · {KIND_LABEL[a.kind]}
                </p>
              </div>
              <span className="num shrink-0 text-[11px] text-subtle" dir="ltr">
                {when(a.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {list.length > 300 && <p className="text-center text-xs text-subtle">يظهر آخر 300 — التصدير فيه الكل.</p>}
    </div>
  );
}

/* ------------------------------ accounts (owner) ------------------------------ */

function PermPicker({ value, onChange }: { value: Perm[]; onChange: (p: Perm[]) => void }) {
  const same = (a: Perm[], b: Perm[]) => a.length === b.length && a.every((x) => b.includes(x));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.perms)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
              same(value, p.perms) ? "border-brand-navy bg-brand-navy text-white" : "border-border bg-surface text-muted hover:text-ink"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-border/50 rounded-2xl border border-border/70">
        {PERMS.map((p) => {
          const on = value.includes(p.key);
          return (
            <li key={p.key}>
              <label className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5">
                <span>
                  <span className="block text-sm font-semibold text-ink">{p.label}</span>
                  {p.hint && <span className="block text-[11px] text-subtle">{p.hint}</span>}
                </span>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange(on ? value.filter((x) => x !== p.key) : [...value, p.key])}
                  className="size-5 shrink-0 accent-[#1d4ed8]"
                />
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EditStaff({ member, data, onClose }: { member: StaffMember; data: AdminData; onClose: () => void }) {
  const [m, setM] = useState<StaffMember>(member.status === "pending" ? { ...member, perms: member.perms.length ? member.perms : PRESETS[0].perms } : member);
  const [busy, setBusy] = useState(false);
  const pending = member.status === "pending";

  async function save(status = m.status) {
    setBusy(true);
    const next = { ...m, name: m.name.trim(), status };
    try {
      await saveStaff(next);
      data.setStaff((prev) => prev.map((x) => (x.id === next.id ? next : x)));
      const permsText = next.perms.map((p) => PERMS.find((x) => x.key === p)?.label).join("، ") || "بدون صلاحيات";
      logActivity({
        kind: "staff",
        action: "update",
        refId: next.id,
        summary:
          pending && status === "active"
            ? `قبول ${next.name}: ${permsText}`
            : status !== member.status
              ? `${status === "disabled" ? "إيقاف" : "تفعيل"} حساب ${next.name}`
              : `صلاحيات ${next.name}: ${permsText}`,
      });
      onClose();
    } catch (e) {
      data.onError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Modal title={pending ? `طلب دخول — ${member.name}` : `صلاحيات ${member.name}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted" dir="ltr">
          {member.email}
        </p>
        <Field label="الاسم">
          <input value={m.name} onChange={(e) => setM({ ...m, name: e.target.value })} className="field px-3 py-2.5 text-sm" />
        </Field>
        <PermPicker value={m.perms} onChange={(perms) => setM({ ...m, perms })} />
        {pending ? (
          <div className="flex gap-2">
            <button onClick={() => save("active")} disabled={busy || !m.name.trim()} className="btn-primary flex-1 py-3 text-sm">
              <Check size={15} /> قبول
            </button>
            <button onClick={() => save("disabled")} disabled={busy} className="btn-ghost px-5 py-3 text-sm text-red-500">
              رفض
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => save()} disabled={busy || !m.name.trim()} className="btn-primary flex-1 py-3 text-sm">
              <Check size={15} /> حفظ
            </button>
            <button
              onClick={() => save(member.status === "disabled" ? "active" : "disabled")}
              disabled={busy}
              className={`btn-ghost px-5 py-3 text-sm ${member.status === "disabled" ? "text-emerald-600" : "text-red-500"}`}
            >
              <Ban size={15} /> {member.status === "disabled" ? "تفعيل" : "إيقاف"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AddStaff({ data, onClose }: { data: AdminData; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [perms, setPerms] = useState<Perm[]>(PRESETS[0].perms);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = name.trim() && /\S+@\S+\.\S+/.test(email) && password.length >= 6;

  async function create() {
    setBusy(true);
    setError("");
    try {
      const m = await createStaffAccount({ name, email, password, perms });
      data.setStaff((prev) => [...prev, m]);
      logActivity({ kind: "staff", action: "create", refId: m.id, summary: `إضافة موظف: ${m.name} (${m.email})` });
      onClose();
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      setError(STAFF_ERRORS[code] ?? (e instanceof Error ? e.message : String(e)));
      setBusy(false);
    }
  }

  return (
    <Modal title="موظف جديد" onClose={onClose}>
      <div className="space-y-4">
        <Field label="الاسم *">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="field px-3 py-2.5 text-sm" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="البريد الإلكتروني *">
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" dir="ltr" className="field px-3 py-2.5 text-sm" />
          </Field>
          <Field label="كلمة المرور *" hint="6 حروف أو أكتر. اديها للموظف.">
            <input value={password} onChange={(e) => setPassword(e.target.value)} dir="ltr" className="field px-3 py-2.5 font-mono text-sm" />
          </Field>
        </div>
        <PermPicker value={perms} onChange={setPerms} />
        {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-500">{error}</p>}
        <button onClick={create} disabled={!valid || busy} className="btn-primary w-full py-3.5 text-sm">
          <UserPlus size={16} /> {busy ? "جارٍ الإنشاء…" : "إنشاء الحساب"}
        </button>
      </div>
    </Modal>
  );
}

function Accounts({ data }: { data: AdminData }) {
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [adding, setAdding] = useState(false);
  const order = { pending: 0, active: 1, disabled: 2 } as const;
  const list = [...data.staff].sort((a, b) => order[a.status] - order[b.status] || (a.role === "owner" ? -1 : 1));
  const pending = list.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {pending > 0 ? (
            <b className="text-amber-600">{pending} طلب دخول بانتظارك</b>
          ) : (
            "الموظف يدخل بالبريد وكلمة المرور اللي بتحددها. لو عنده حساب قبل كده، يسجّل دخول ويظهر هنا كطلب."
          )}
        </p>
        <button onClick={() => setAdding(true)} disabled={demoMode} className="btn-primary px-4 py-2.5 text-xs disabled:opacity-40">
          <UserPlus size={14} /> موظف جديد
        </button>
      </div>

      {list.length === 0 ? (
        <Empty title={demoMode ? "الفريق يحتاج Firebase" : "لسه ما في موظفين"} />
      ) : (
        <ul className="space-y-2">
          {list.map((s) => (
            <li key={s.id} className="card-sm flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink">{s.name}</span>
                  {s.role === "owner" ? (
                    <span className="chip bg-accent/15 text-accent">
                      <Crown size={11} /> المالك
                    </span>
                  ) : (
                    <span className={`chip ${STATUS_TONE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-subtle" dir="ltr">
                  {s.email}
                </p>
                {s.role !== "owner" && (
                  <p className="mt-1.5 flex flex-wrap gap-1">
                    {s.perms.length ? (
                      s.perms.map((p) => (
                        <span key={p} className="rounded-md bg-surface2 px-1.5 py-0.5 text-[10px] text-muted">
                          {PERMS.find((x) => x.key === p)?.label}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-subtle">بدون صلاحيات</span>
                    )}
                  </p>
                )}
              </div>
              {s.role !== "owner" && (
                <button onClick={() => setEditing(s)} className={`shrink-0 px-3.5 py-2 text-xs ${s.status === "pending" ? "btn-primary" : "btn-ghost"}`}>
                  {s.status === "pending" ? <KeyRound size={13} /> : <Pencil size={13} />} {s.status === "pending" ? "مراجعة" : "تعديل"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing && <EditStaff member={editing} data={data} onClose={() => setEditing(null)} />}
      {adding && <AddStaff data={data} onClose={() => setAdding(false)} />}
    </div>
  );
}

/* ------------------------------ page ------------------------------ */

type Section = "performance" | "activity" | "accounts";

export default function TeamTab({ data }: { data: AdminData }) {
  const owner = data.me.role === "owner";
  const pending = data.staff.filter((s) => s.status === "pending").length;
  const sections: [Section, string][] = [
    ["performance", "أداء الفريق"],
    ["activity", "سجل النشاط"],
    ...(owner ? ([["accounts", pending ? `الحسابات (${pending})` : "الحسابات"]] as [Section, string][]) : []),
  ];
  const [section, setSection] = useState<Section>(owner && pending ? "accounts" : "performance");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-2xl bg-surface2 p-1" role="tablist">
        {sections.map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={section === k}
            onClick={() => setSection(k)}
            className={`flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              section === k ? "bg-surface text-ink shadow-soft" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <Panel title={sections.find(([k]) => k === section)?.[1] ?? ""}>
        {section === "performance" ? <Performance data={data} /> : section === "activity" ? <ActivityLog data={data} /> : <Accounts data={data} />}
      </Panel>
    </div>
  );
}
