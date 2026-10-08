import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { PAIRS, type CurrencyCode } from "@/lib/corridors";
import { buildUsdtPrices, fetchMarketData, pairMarketPrices, type UsdtPrices } from "@/lib/fx";
import { mergeHistoryEntry, todayDateStr, type RateHistoryPoint } from "@/lib/rateHistory";
import { computeRate } from "@/lib/rates";
import { isReached } from "@/lib/alerts";
import { CURRENCIES, isForwardDirection, isMultiplyCorridor } from "@/lib/corridors";
import { formatRate } from "@/lib/format";
import type { Firestore } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let data;
  try {
    data = await fetchMarketData();
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 502 }
    );
  }

  const db = getAdminDb();
  // One price per currency (units per 1 USDT), saved so /admin can show
  // exactly which Binance ads were used — then every pair is built from it.
  const pricesRef = db.collection("settings").doc("usdtPrices");
  const prevSnap = await pricesRef.get();
  const prev: UsdtPrices = (prevSnap.exists ? prevSnap.data()?.prices : null) ?? {};
  const { prices, problems } = buildUsdtPrices(prev, data);
  await pricesRef.set({ prices, updatedAt: new Date() });

  const updated: { pair: string; marketPrice: number }[] = [];
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
    updated.push({ pair: key, marketPrice });
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

  return NextResponse.json({ ok: true, at: new Date().toISOString(), prices, problems, updated: updated.length, alerts });
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
          subject: `Master Digital — السعر وصل: ${a.from} → ${a.to}`,
          html: `<div dir="rtl" style="font-family:sans-serif;font-size:16px;line-height:1.8">
            <p>السلام عليكم${a.name ? ` ${a.name}` : ""}،</p>
            <p>السعر اللي طلبت تنبيه عليه وصل: <b>${CURRENCIES[a.from].currency} ← ${CURRENCIES[a.to].currency}</b></p>
            <p dir="ltr" style="font-size:20px"><b>1 ${one} = ${formatRate(rate)} ${other}</b></p>
            <p>السعر المطلوب كان <span dir="ltr">${formatRate(a.target)}</span>. راسلنا على واتساب عشان نكمل ليك التحويل.</p>
            <p>Master Digital — ماستر للخدمات المصرفية</p></div>`,
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
