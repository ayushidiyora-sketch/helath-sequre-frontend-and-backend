import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTiers, type SubscriptionTier } from "@/lib/tiers";

export const runtime = "nodejs";

/**
 * Edit a subscription tier (Super Admin only). Changes propagate to the public
 * pricing page + the tiers editor, which both read `subscription_tiers`.
 *
 * Editable fields are merged onto the current row (so an omitted field is left
 * unchanged) — `monthly`/`annualMonthly` are nullable, which COALESCE can't
 * express, so we merge in JS and re-write every column.
 */
interface PatchBody {
  name?: string;
  tagline?: string;
  monthly?: number | null;
  annualMonthly?: number | null;
  unit?: string;
  ctaLabel?: string;
  featured?: boolean;
  bullets?: string[];
}

function intOrNull(v: number | null | undefined, fallback: number | null): number | null {
  if (v === undefined) return fallback;
  if (v === null) return null;
  return Math.max(0, Math.floor(Number(v)));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (claims.role !== "Super Admin")
    return NextResponse.json({ ok: false, error: "Forbidden — Super Admin only." }, { status: 403 });

  let body: PatchBody;
  try { body = (await req.json()) as PatchBody; }
  catch { return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 }); }

  const all = await getTiers();
  const cur: SubscriptionTier | undefined = all.find((t) => t.id === id);
  if (!cur) return NextResponse.json({ ok: false, error: "Tier not found" }, { status: 404 });

  // Merge editable fields onto the current row.
  const name = body.name?.trim() ?? cur.name;
  if (!name) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
  const tagline = body.tagline?.trim() ?? cur.tagline;
  const unit = body.unit?.trim() ?? cur.unit;
  const ctaLabel = body.ctaLabel?.trim() ?? cur.ctaLabel;
  const monthly = intOrNull(body.monthly, cur.monthly);
  const annualMonthly = intOrNull(body.annualMonthly, cur.annualMonthly);
  const featured = typeof body.featured === "boolean" ? body.featured : cur.featured;
  const bullets = Array.isArray(body.bullets)
    ? body.bullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 20)
    : cur.bullets;

  // A featured tier is exclusive — clear the flag on the others.
  if (featured) {
    await prisma.$executeRaw`UPDATE subscription_tiers SET featured = false WHERE id <> ${id}`;
  }

  await prisma.$executeRaw`
    UPDATE subscription_tiers SET
      name = ${name},
      tagline = ${tagline},
      monthly = ${monthly},
      "annualMonthly" = ${annualMonthly},
      unit = ${unit},
      "ctaLabel" = ${ctaLabel},
      featured = ${featured},
      bullets = ${JSON.stringify(bullets)}::jsonb,
      "updatedAt" = NOW()
    WHERE id = ${id}
  `;

  const tiers = await getTiers();
  return NextResponse.json({ ok: true, tier: tiers.find((t) => t.id === id) ?? null, tiers });
}
