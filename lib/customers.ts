import { blankCustomer, type Customer, type Gender } from "./data";
import type { CustomerStat } from "./stats";
import { todayStr } from "./format";

/* ---------- Status — the same rules as the old customer sheet ---------- */

export type CustomerStatus = "none" | "new" | "inactive" | "risk" | "vip" | "potential" | "active";

export const STATUS_META: Record<CustomerStatus, { label: string; tone: string }> = {
  none: { label: "📭 بدون تعاملات", tone: "bg-surface2 text-subtle" },
  new: { label: "🆕 عميل جديد", tone: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
  vip: { label: "👑 VIP", tone: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  potential: { label: "⭐ VIP محتمل", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  active: { label: "⚡ نشط", tone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  risk: { label: "⚠️ معرض للفقد", tone: "bg-orange-500/15 text-orange-600 dark:text-orange-400" },
  inactive: { label: "💤 غير نشط", tone: "bg-red-500/10 text-red-500" },
};

export const STATUS_ORDER: CustomerStatus[] = ["vip", "potential", "active", "new", "risk", "inactive", "none"];

const dayMs = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / dayMs);

/** Checked in this order, exactly like the sheet:
 *  no deals → first deal within 30 days = new → last deal 61+ days ago =
 *  inactive → 31+ days = churn risk → 10+ deals = VIP → 5+ = potential VIP
 *  → otherwise active. */
export function customerStatus(stat: CustomerStat, today = todayStr()): { status: CustomerStatus; daysAbsent: number | null } {
  if (!stat.count || !stat.firstDate || !stat.lastDate) return { status: "none", daysAbsent: null };
  const daysAbsent = daysBetween(stat.lastDate, today);
  let status: CustomerStatus;
  if (daysBetween(stat.firstDate, today) <= 30) status = "new";
  else if (daysAbsent >= 61) status = "inactive";
  else if (daysAbsent >= 31) status = "risk";
  else if (stat.count >= 10) status = "vip";
  else if (stat.count >= 5) status = "potential";
  else status = "active";
  return { status, daysAbsent };
}

/* ---------- Display helpers ---------- */

export const displayName = (c: Customer) => (c.title ? `${c.title} ${c.name}` : c.name);

export function customerWaLink(c: Customer): string | null {
  const digits = c.phone.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`السلام عليكم يا ${displayName(c)}`)}`;
}

const PREFIX_COUNTRY: [string, string][] = [
  ["249", "السودان"],
  ["211", "جنوب السودان"],
  ["256", "أوغندا"],
  ["250", "رواندا"],
  ["254", "كينيا"],
  ["966", "السعودية"],
  ["971", "الإمارات"],
  ["218", "ليبيا"],
  ["235", "تشاد"],
  ["20", "مصر"],
];

/** Country from an international phone number, when the code is known. */
export function countryFromPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").replace(/^00/, "");
  return PREFIX_COUNTRY.find(([p]) => d.startsWith(p))?.[1] ?? "";
}

/* ---------- Import from a CSV file ---------- */

/** Minimal CSV reader: quotes, commas or semicolons, BOM, CRLF. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/** Header names accepted for each field (Arabic or the old sheet's English). */
const HEADERS: Record<string, string[]> = {
  code: ["رقم العميل", "الرقم", "id", "column 1", "code"],
  name: ["الاسم", "اسم العميل", "name"],
  title: ["اللقب", "title", "column 5"],
  phone: ["الهاتف", "رقم الهاتف", "phone", "phnone number", "phone number"],
  gender: ["الجنس", "gender"],
  country: ["الدولة", "country"],
  notes: ["ملاحظات", "notes"],
};

export interface ImportRow {
  code?: number;
  name: string;
  title: string;
  phone: string;
  gender: Gender;
  country: string;
  notes: string;
}

export interface ImportPlan {
  create: Customer[];
  update: Customer[];
  unchanged: number;
  skipped: string[]; // why rows were left out
}

function cleanPhone(raw: string): string {
  const s = raw.trim().replace(/\.0+$/, "");
  const d = s.replace(/\D/g, "");
  if (!d) return "";
  return s.startsWith("0") && !s.startsWith("00") ? s : `+${d.replace(/^00/, "")}`;
}

function genderOf(raw: string, title: string): Gender {
  const g = raw.trim().toLowerCase();
  if (["male", "m", "ذكر"].includes(g)) return "male";
  if (["female", "f", "أنثى", "انثى"].includes(g)) return "female";
  if (/الأخت|السيدة|الأستاذة|الاستاذة|الدكتورة/.test(title)) return "female";
  if (/الأخ|السيد|الأستاذ|الاستاذ|الدكتور/.test(title)) return "male";
  return "";
}

export function readImportRows(text: string): { rows: ImportRow[]; error?: string } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], error: "الملف فاضي أو ما فيه غير العناوين" };
  const head = table[0].map((h) => h.trim().toLowerCase());
  const col = (field: string) => head.findIndex((h) => HEADERS[field].includes(h));
  const idx = Object.fromEntries(Object.keys(HEADERS).map((f) => [f, col(f)]));
  if (idx.name < 0) return { rows: [], error: "ما لقينا عمود «الاسم» في أول سطر من الملف" };
  const get = (r: string[], f: string) => (idx[f] >= 0 ? (r[idx[f]] ?? "").trim() : "");
  const rows = table.slice(1).map((r) => {
    const title = get(r, "title");
    const phone = cleanPhone(get(r, "phone"));
    const code = parseInt(get(r, "code"), 10);
    return {
      code: Number.isFinite(code) && code > 0 ? code : undefined,
      name: get(r, "name"),
      title,
      phone,
      gender: genderOf(get(r, "gender"), title),
      country: get(r, "country") || countryFromPhone(phone),
      notes: get(r, "notes"),
    };
  });
  return { rows };
}

/** Matches each row to an existing customer — by customer number first,
 *  then by phone — so importing the same file twice never duplicates
 *  anyone. Existing notes are kept; empty cells never wipe saved data. */
export function planImport(rows: ImportRow[], existing: Customer[]): ImportPlan {
  const byCode = new Map(existing.filter((c) => c.code).map((c) => [c.code!, c]));
  const digits = (p: string) => p.replace(/\D/g, "");
  const byPhone = new Map(existing.filter((c) => digits(c.phone).length >= 8).map((c) => [digits(c.phone), c]));
  const plan: ImportPlan = { create: [], update: [], unchanged: 0, skipped: [] };
  let nextCode = existing.reduce((m, c) => Math.max(m, c.code ?? 0), 0);
  for (const r of rows) nextCode = Math.max(nextCode, r.code ?? 0);
  const seen = new Set<string>();

  rows.forEach((r, i) => {
    if (!r.name && !r.phone) return;
    if (!r.name) {
      plan.skipped.push(`سطر ${i + 2}: بدون اسم`);
      return;
    }
    const match = (r.code && byCode.get(r.code)) || (digits(r.phone).length >= 8 ? byPhone.get(digits(r.phone)) : undefined);
    if (match) {
      if (seen.has(match.id)) {
        plan.skipped.push(`سطر ${i + 2}: «${r.name}» مكرر في الملف`);
        return;
      }
      seen.add(match.id);
      const next: Customer = {
        ...match,
        code: match.code ?? r.code,
        name: r.name,
        title: r.title || match.title || "",
        gender: r.gender || match.gender || "",
        phone: r.phone || match.phone,
        country: r.country || match.country,
        notes: match.notes || r.notes,
      };
      const changed = (["code", "name", "title", "gender", "phone", "country", "notes"] as const).some((k) => next[k] !== match[k]);
      if (changed) plan.update.push(next);
      else plan.unchanged++;
      return;
    }
    const c = blankCustomer(r.code ?? ++nextCode);
    plan.create.push({ ...c, name: r.name, title: r.title, gender: r.gender, phone: r.phone, country: r.country, notes: r.notes });
  });
  return plan;
}

export const IMPORT_TEMPLATE_HEADER = ["رقم العميل", "الاسم", "اللقب", "الهاتف", "الجنس", "الدولة", "ملاحظات"];
