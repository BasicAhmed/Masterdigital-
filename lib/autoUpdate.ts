import { PAIRS, type CurrencyCode } from "@/lib/corridors";
import { buildUsdtPrices, fetchMarketData, pairMarketPrices, type UsdtPrices } from "@/lib/fx";
import { mergeHistoryEntry, todayDateStr, type RateHistoryPoint } from "@/lib/rateHistory";
import { computeRate } from "@/lib/rates";
import { isReached } from "@/lib/alerts";
import { CURRENCIES, isForwardDirection, isMultiplyCorridor } from "@/lib/corridors";
import { formatRate } from "@/lib/format";
import { AUTO_DEFAULT, readAutoUpdate } from "@/lib/autoUpdateConfig";
import type { Firestore } from "firebase-admin/firestore";

export interface RunResult {
  ok: boolean;
  at: string;
  error?: string;
  prices?: UsdtPrices;
  problems?: unknown;
  updated?: number;
  alerts?: { reached: number; emailed: number; error?: string };
}

/** Pulls Binance P2P, saves one USDT price per currency (typed/manual prices
 *  are kept as they are), rebuilds every pair + its history, then checks the
 *  price alerts. Used by the scheduled jobs and the public /api/rates/tick. */
export async function runRateUpdate(db: Firestore): Promise<RunResult> {
  let data;
  try {
    data = await fetchMarketData();
  } catch (err) {
    return { ok: false, at: new Date().toISOString(), error: err instanceof Error ? err.message : String(err) };
  }

  // One price per currency (units per 1 USDT), saved so /admin can show
  // exactly which Binance ads were used — then every pair is built from it.
  const pricesRef = db.collection("settings").doc("usdtPrices");
  const prevSnap = await pricesRef.get();
  const prev: UsdtPrices = (prevSnap.exists ? prevSnap.data()?.prices : null) ?? {};
  const { prices, problems } = buildUsdtPrices(prev, data);
  await pricesRef.set({ prices, updatedAt: new Date() });

  let updated = 0;
  const jobs = pairMarketPrices(prices).map(async ({ a, b, marketPrice }) => {
    const key = `${a}_${b}`;
    const historyRef = db.collection("rateHistory").doc(key);
    const [, historySnap] = await Promise.all([
      db.collection("rates").doc(key).set(
        { from: a, to: b, marketPrice, updatedAt: new Date(), source: "auto-binance-p2p" },
        { merge: true }
      ),
      historyRef.get(),
    ]);
    updated++;
    const existing: RateHistoryPoint[] = historySnap.exists ? historySnap.data()?.entries ?? [] : [];
    await historyRef.set({ entries: mergeHistoryEntry(existing, todayDateStr(), marketPrice) });
  });
  await Promise.all(jobs);

  // Price alerts: with the fresh prices in, flag every alert whose target is now met.
  let alerts: { reached: number; emailed: number; error?: string } = { reached: 0, emailed: 0 };
  try {
    alerts = await processAlerts(db);
  } catch (err) {
    alerts = { reached: 0, emailed: 0, error: err instanceof Error ? err.message : String(err) };
  }

  return { ok: true, at: new Date().toISOString(), prices, problems, updated, alerts };
}

/** Runs the update only if the owner chose «تلقائي» and the chosen interval
 *  has passed since the last automatic run. A transaction claims the slot
 *  first, so many visitors pinging at once still cause at most one run.
 *  `force` (the daily Vercel cron) skips the interval check but still obeys
 *  «يدوي». */
export async function runIfDue(db: Firestore, opts: { force?: boolean } = {}) {
  const ref = db.collection("settings").doc("autoUpdate");
  const claim = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const cfg = snap.exists ? readAutoUpdate(snap.data()) : AUTO_DEFAULT;
    if (cfg.mode !== "auto") return { run: false as const, reason: "manual", cfg };
    const last = cfg.lastRunAt ? Date.parse(cfg.lastRunAt) : 0;
    const dueAt = last + cfg.everyMinutes * 60_000 - 60_000; // a minute of grace for timer drift
    if (!opts.force && Date.now() < dueAt) return { run: false as const, reason: "not-due", cfg, nextAt: new Date(dueAt + 60_000).toISOString() };
    t.set(ref, { lastRunAt: new Date().toISOString() }, { merge: true });
    return { run: true as const, cfg };
  });
  if (!claim.run) return { ran: false, reason: claim.reason, nextAt: "nextAt" in claim ? claim.nextAt : undefined };

  const result = await runRateUpdate(db);
  await ref.set(
    { lastResult: { ok: result.ok, at: result.at, updated: result.updated ?? 0, error: result.error ?? null } },
    { merge: true }
  );
  return { ran: true, result };
}

/** Works out today's customer rate for every direction (market price ×
 *  that direction's margin — same formula as the site), marks the active
 *  alerts that reached their target, and emails the customers who left an
 *  address when RESEND_API_KEY + ALERT_FROM_EMAIL are configured. WhatsApp
 *  notices are sent by staff from /admin → تنبيهات الأسعار with one tap. */
async function processAlerts(db: Firestore): Promise<{ reached: number; emailed: number }> {
  const active = await db.collection("alerts").where("status", "==", "active").get();
  if (active.empty) return { reached: 0, emailed: 0 };

  const [ratesSnap, marginSnap, flowsSnap] = await Promise.all([
    db.collection("rates").get(),
    db.collection("settings").doc("margin").get(),
    db.collection("settings").doc("flows").get(),
  ]);
  const globalMargin = typeof marginSnap.data()?.percent === "number" ? (marginSnap.data()!.percent as number) : 2.5;
  const disabled: string[] = Array.isArray(flowsSnap.data()?.disabled) ? flowsSnap.data()!.disabled : [];
  const pairs = new Map(ratesSnap.docs.map((d) => [d.id, d.data()]));

  const rateFor = (from: CurrencyCode, to: CurrencyCode): number | null => {
    if (disabled.includes(`${from}_${to}`)) return null;
    const pair = PAIRS.find((p) => (p.a === from && p.b === to) || (p.a === to && p.b === from));
    if (!pair) return null;
    const doc = pairs.get(`${pair.a}_${pair.b}`);
    if (!doc || typeof doc.marketPrice !== "number") return null;
    const override = isForwardDirection(from, to) ? doc.marginForward : doc.marginReverse;
    return computeRate(from, to, doc.marketPrice, typeof override === "number" ? override : globalMargin);
  };

  let reached = 0;
  let emailed = 0;
  for (const docSnap of active.docs) {
    const a = docSnap.data() as { from: CurrencyCode; to: CurrencyCode; target: number; email?: string; name?: string };
    const rate = rateFor(a.from, a.to);
    if (rate === null || !isReached(a, rate)) continue;
    reached++;
    let status = "reached";
    if (a.email && process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL) {
      const [one, other] = isMultiplyCorridor(a.from, a.to) ? [a.from, a.to] : [a.to, a.from];
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.ALERT_FROM_EMAIL,
          to: a.email,
          subject: `تحديث سعر الصرف — السعر وصل: ${a.from} → ${a.to}`,
          html: `<div dir="rtl" style="font-family:sans-serif;font-size:16px;line-height:1.8">
            <p>السلام عليكم${a.name ? ` ${a.name}` : ""}،</p>
            <p>السعر اللي طلبت تنبيه عليه وصل: <b>${CURRENCIES[a.from].currency} ← ${CURRENCIES[a.to].currency}</b></p>
            <p dir="ltr" style="font-size:20px"><b>1 ${one} = ${formatRate(rate)} ${other}</b></p>
            <p>السعر المطلوب كان <span dir="ltr">${formatRate(a.target)}</span>. راسلنا على واتساب عشان نكمل ليك التحويل.</p>
            <p>تحديث سعر الصرف</p></div>`,
        }),
      }).catch(() => null);
      if (res && res.ok) {
        emailed++;
        status = "notified";
      }
    }
    await docSnap.ref.set({ status, reachedAt: new Date().toISOString(), reachedRate: rate }, { merge: true });
  }
  return { reached, emailed };
}
