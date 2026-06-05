import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isDbUid, verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Org Admin → Notification templates.
 *
 * GET  /api/admin/templates    → all templates for the tenant, grouped by slug.
 *                                Each top-level entry is the currently-active
 *                                version; archived versions live under `history`.
 * POST /api/admin/templates    → create a brand-new template (v1) with a new slug.
 *
 * Per-slug updates (save-as-new-version) live on the [id] sub-route.
 */

type Channel = "email" | "sms" | "inapp";
const VALID_CHANNELS: ReadonlySet<Channel> = new Set(["email", "sms", "inapp"]);

interface Guard {
  error?: NextResponse;
  claims?: {
    uid: string;
    role: string;
    org: string;
    email: string;
  };
}

async function requireOrgAdmin(): Promise<Guard> {
  const jar = await cookies();
  const claims = await verifySession(jar.get(SESSION_COOKIE)?.value);
  if (!claims) {
    return { error: NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 }) };
  }
  if (claims.role !== "Org Admin") {
    return {
      error: NextResponse.json(
        { ok: false, error: "Forbidden — Org Admin only." },
        { status: 403 },
      ),
    };
  }
  if (!claims.org) {
    return { error: NextResponse.json({ ok: false, error: "No tenant on session" }, { status: 400 }) };
  }
  return {
    claims: { uid: claims.uid, role: claims.role, org: claims.org, email: claims.email },
  };
}

async function resolveOrgId(slug: string): Promise<string | null> {
  const r = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM organizations WHERE slug = ${slug} LIMIT 1
  `;
  return r[0]?.id ?? null;
}

interface TemplateRow {
  id: string;
  slug: string;
  name: string;
  channels: string[];
  subject: string | null;
  body: string;
  version: number;
  isActive: boolean;
  smsLimit: number | null;
  createdByEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  const g = await requireOrgAdmin();
  if (g.error) return g.error;
  const orgId = await resolveOrgId(g.claims!.org);
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
  }

  try {
    const rows = await prisma.$queryRaw<TemplateRow[]>`
      SELECT id, slug, name, channels, subject, body, version, "isActive",
             "smsLimit", "createdByEmail", "createdAt", "updatedAt"
      FROM notification_templates
      WHERE "organizationId" = ${orgId}::uuid
      ORDER BY slug ASC, version DESC
    `;

    // Group by slug. The first row per slug (highest version, but we sort by
    // isActive desc first to be safe) is the current. The rest are history.
    const bySlug = new Map<string, TemplateRow[]>();
    for (const r of rows) {
      const list = bySlug.get(r.slug) ?? [];
      list.push(r);
      bySlug.set(r.slug, list);
    }

    const templates = Array.from(bySlug.entries()).map(([slug, versions]) => {
      // Prefer the isActive row as current; fall back to highest version.
      const current = versions.find((v) => v.isActive) ?? versions[0];
      const history = versions
        .filter((v) => v.id !== current.id)
        .map((v) => ({
          id: v.id,
          version: v.version,
          createdAt: v.createdAt.toISOString(),
          createdByEmail: v.createdByEmail,
        }));
      return {
        id: current.id,
        slug,
        name: current.name,
        channels: current.channels as Channel[],
        subject: current.subject,
        body: current.body,
        version: current.version,
        isActive: current.isActive,
        smsLimit: current.smsLimit,
        createdAt: current.createdAt.toISOString(),
        createdByEmail: current.createdByEmail,
        history,
      };
    });

    return NextResponse.json({ ok: true, templates });
  } catch (err) {
    console.error("[templates GET] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

interface PostBody {
  name?: string;
  channels?: string[];
  subject?: string;
  body?: string;
  smsLimit?: number;
}

export async function POST(req: Request) {
  const g = await requireOrgAdmin();
  if (g.error) return g.error;
  const orgId = await resolveOrgId(g.claims!.org);
  if (!orgId) {
    return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name || name.length > 120) {
    return NextResponse.json(
      { ok: false, error: "Name required (max 120 chars)." },
      { status: 400 },
    );
  }
  const channels = (body.channels ?? []).filter((c): c is Channel =>
    VALID_CHANNELS.has(c as Channel),
  );
  if (channels.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Pick at least one channel (email / sms / inapp)." },
      { status: 400 },
    );
  }
  const subject = (body.subject ?? "").trim() || null;
  const bodyText = (body.body ?? "").trim();
  if (!bodyText) {
    return NextResponse.json({ ok: false, error: "Body is required." }, { status: 400 });
  }
  if (bodyText.length > 8000) {
    return NextResponse.json({ ok: false, error: "Body too long (max 8000 chars)." }, { status: 400 });
  }
  const smsLimit =
    channels.includes("sms") && Number.isFinite(body.smsLimit)
      ? Math.max(40, Math.min(1600, Math.floor(Number(body.smsLimit))))
      : null;

  // Build a unique slug. If the user picks a name that collides, append a suffix.
  let slug = slugify(name);
  if (!slug) slug = "template";
  const existing = await prisma.$queryRaw<{ slug: string }[]>`
    SELECT slug FROM notification_templates
    WHERE "organizationId" = ${orgId}::uuid AND slug LIKE ${slug + "%"}
  `;
  const taken = new Set(existing.map((r) => r.slug));
  if (taken.has(slug)) {
    let i = 2;
    while (taken.has(`${slug}-${i}`)) i++;
    slug = `${slug}-${i}`;
  }

  const createdById = isDbUid(g.claims!.uid) ? g.claims!.uid : null;
  try {
    const [row] = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO notification_templates (
        "organizationId", slug, name, channels, subject, body,
        version, "isActive", "smsLimit",
        "createdById", "createdByEmail", "createdAt", "updatedAt"
      ) VALUES (
        ${orgId}::uuid, ${slug}, ${name}, ${channels}::text[], ${subject}, ${bodyText},
        1, true, ${smsLimit},
        ${createdById}::uuid, ${g.claims!.email}, NOW(), NOW()
      )
      RETURNING id
    `;
    return NextResponse.json(
      { ok: true, id: row.id, slug, version: 1 },
      { status: 201 },
    );
  } catch (err) {
    console.error("[templates POST] failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}
