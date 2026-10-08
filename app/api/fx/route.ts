import { NextResponse } from "next/server";
import { fetchMarketData } from "@/lib/fx";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Same-origin relay for the admin panel's "update now" button — avoids
 *  browser CORS issues hitting Binance / open.er-api.com directly. Returns
 *  Binance's buy and sell side for every currency plus the regular FX table.
 *  No secret needed, it's read-only public rate data. */
export async function GET() {
  try {
    return NextResponse.json(await fetchMarketData());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
