import { NextResponse } from "next/server";
import { getTiers } from "@/lib/tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public subscription tiers — drives the marketing pricing page + the
 *  Super Admin tiers editor. No auth (pricing is public). */
export async function GET() {
  try {
    const tiers = await getTiers();
    return NextResponse.json({ ok: true, tiers });
  } catch {
    return NextResponse.json({ ok: true, tiers: [] });
  }
}
