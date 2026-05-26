import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token || token.length < 16) {
    return NextResponse.json({ ok: false, error: "Invalid or missing token" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
