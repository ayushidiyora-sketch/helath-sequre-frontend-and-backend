import { prisma } from "@/lib/prisma";

/**
 * Render an org's active notification template (from `notification_templates`)
 * by substituting `{{dotted.key}}` placeholders. Used so admin-editable
 * templates drive the actual emails (e.g. the patient-invitation welcome).
 *
 * `vars` is keyed by the dotted names that appear in templates, e.g.
 * `{ "patient.first_name": "Aarav", "organization.name": "City Hospital", "action_url": "https://…" }`.
 */
export interface RenderedTemplate {
  found: boolean;
  subject: string;
  body: string;
}

function substitute(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key: string) => vars[key] ?? "");
}

export async function renderTemplate(
  orgId: string,
  slug: string,
  vars: Record<string, string>,
): Promise<RenderedTemplate> {
  const rows = await prisma.$queryRaw<{ subject: string | null; body: string }[]>`
    SELECT subject, body FROM notification_templates
    WHERE "organizationId" = ${orgId}::uuid AND slug = ${slug} AND "isActive" = true
    ORDER BY version DESC
    LIMIT 1
  `;
  if (!rows[0]) return { found: false, subject: "", body: "" };
  return {
    found: true,
    subject: substitute(rows[0].subject ?? "", vars),
    body: substitute(rows[0].body, vars),
  };
}
