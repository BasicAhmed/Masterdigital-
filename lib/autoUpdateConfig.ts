/** settings/autoUpdate — the owner's choice between automatic and manual
 *  price updates. Plain data only, shared by the admin and the server. */

export type UpdateMode = "auto" | "manual";

export interface AutoUpdateConfig {
  mode: UpdateMode;
  everyMinutes: number;
  lastRunAt?: string;
  lastResult?: { ok: boolean; at: string; updated: number; error: string | null };
}

export const INTERVALS: { minutes: number; label: string }[] = [
  { minutes: 15, label: "كل 15 دقيقة" },
  { minutes: 30, label: "كل 30 دقيقة" },
  { minutes: 60, label: "كل ساعة" },
  { minutes: 180, label: "كل 3 ساعات" },
  { minutes: 360, label: "كل 6 ساعات" },
  { minutes: 720, label: "كل 12 ساعة" },
  { minutes: 1440, label: "مرة في اليوم" },
];

/** Until the owner picks something: automatic, once a day — what the site did before. */
export const AUTO_DEFAULT: AutoUpdateConfig = { mode: "auto", everyMinutes: 1440 };

export function readAutoUpdate(raw: unknown): AutoUpdateConfig {
  const d = (raw ?? {}) as Record<string, unknown>;
  const mode: UpdateMode = d.mode === "manual" ? "manual" : "auto";
  const every = typeof d.everyMinutes === "number" && d.everyMinutes >= 15 ? d.everyMinutes : AUTO_DEFAULT.everyMinutes;
  const lr = d.lastResult as AutoUpdateConfig["lastResult"] | undefined;
  return {
    mode,
    everyMinutes: every,
    lastRunAt: typeof d.lastRunAt === "string" ? d.lastRunAt : undefined,
    lastResult: lr && typeof lr === "object" && typeof lr.at === "string" ? lr : undefined,
  };
}

export function intervalLabel(minutes: number) {
  return INTERVALS.find((i) => i.minutes === minutes)?.label ?? `كل ${minutes} دقيقة`;
}
