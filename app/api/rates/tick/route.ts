import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { runIfDue } from "@/lib/autoUpdate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Public "is an update due?" ping. Safe to call from anywhere: it only runs
 *  when the owner chose «تلقائي» and the chosen interval (15 min, 30 min, …)
 *  has passed, so nobody can make prices refresh more often than that.
 *  Called by the site, the admin, and a GitHub Actions schedule. */
async function handle() {
  try {
    const out = await runIfDue(getAdminDb());
    if (out.ran) revalidatePath("/");
    return NextResponse.json(
      out.ran ? { ran: true, ok: out.result?.ok, at: out.result?.at, updated: out.result?.updated } : out,
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json({ ran: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
