import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { runIfDue } from "@/lib/autoUpdate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Daily Vercel cron (Hobby plan allows one run a day). Follows the owner's
 *  choice in /admin: does nothing when the mode is «يدوي». The frequent runs
 *  come from /api/rates/tick. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const out = await runIfDue(getAdminDb(), { force: true });
    if (out.ran) revalidatePath("/");
    return NextResponse.json(out, { status: out.ran && out.result && !out.result.ok ? 502 : 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
