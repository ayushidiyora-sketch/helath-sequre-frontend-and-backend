import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DEFAULT_PRIMARY = "#0E7490";
const DEFAULT_SECONDARY = "#FFFFFF";

function readBranding(raw: Prisma.JsonValue | null) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const settings = raw as Record<string, unknown>;
  const b = settings.branding;
  if (!b || typeof b !== "object" || Array.isArray(b)) return {};
  return b as { logoUrl?: string; primaryColor?: string; secondaryColor?: string };
}

/**
 * Returns the signed-in user's tenant branding (logo + colors) so the
 * BrandingThemeProvider can apply CSS variables on every page load for every
 * role. Public defaults are returned when no session is present so the
 * marketing site and auth screens still render.
 */
export async function GET() {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);

  const defaults = {
    logoUrl: "",
    primaryColor: DEFAULT_PRIMARY,
    secondaryColor: DEFAULT_SECONDARY,
  };

  if (!claims?.org) {
    return NextResponse.json({ ok: true, branding: defaults });
  }

  const org = await prisma.organization.findUnique({
    where: { slug: claims.org },
    select: { settings: true },
  });
  if (!org) {
    return NextResponse.json({ ok: true, branding: defaults });
  }
  const b = readBranding(org.settings);
  return NextResponse.json({
    ok: true,
    branding: {
      logoUrl: b.logoUrl ?? "",
      primaryColor: b.primaryColor || DEFAULT_PRIMARY,
      secondaryColor: b.secondaryColor || DEFAULT_SECONDARY,
    },
  });
}
