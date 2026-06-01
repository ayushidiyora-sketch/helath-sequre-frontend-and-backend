/**
 * URL slug for staff routes. Combines the staff member's name with their full
 * UUID so the URL is human-readable but routes still resolve unambiguously
 * (`extractUid` pulls the UUID back out, no DB lookup needed). No slug column
 * required — the slug is purely derived from `firstName + lastName + id`.
 *
 *   staffSlug({ firstName: "Priya", lastName: "Shah", id: "bd27c110-…" })
 *     → "priya-shah-bd27c110-36b6-4666-a418-99211a19420c"
 *
 *   extractUid("priya-shah-bd27c110-36b6-4666-a418-99211a19420c")
 *     → "bd27c110-36b6-4666-a418-99211a19420c"
 *
 *   extractUid("bd27c110-36b6-4666-a418-99211a19420c")  // bare UUID still works
 *     → "bd27c110-36b6-4666-a418-99211a19420c"
 */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function staffSlug(u: { firstName: string; lastName: string; id: string }): string {
  const namePart = `${u.firstName}-${u.lastName}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return namePart ? `${namePart}-${u.id}` : u.id;
}

export function extractUid(slug: string): string | null {
  return UUID_RE.exec(slug)?.[0] ?? null;
}
