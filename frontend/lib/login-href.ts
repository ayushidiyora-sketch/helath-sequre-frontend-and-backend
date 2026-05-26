/**
 * Map the current authenticated path to the role-appropriate sign-in page.
 *
 *   /super/...     → /super-login   (Sensussoft platform operators)
 *   /patient/...   → /login         (patients)
 *   everything else under a role layout (/clinician, /admin, /compliance,
 *   /auditor) → /staff-login        (clinical and admin staff)
 */
export function loginHrefForPath(path: string | null | undefined): string {
  if (!path) return "/login";
  if (path.startsWith("/super")) return "/super-login";
  if (path.startsWith("/patient")) return "/login";
  return "/staff-login";
}
