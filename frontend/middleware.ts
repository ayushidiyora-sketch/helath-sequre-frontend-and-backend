import { NextRequest, NextResponse } from "next/server";
import { verifySession, roleHome, ROLE_PREFIX, SESSION_COOKIE } from "@/lib/auth";

/** URL prefixes that require an authenticated session. */
const PROTECTED_PREFIXES = ["/patient", "/clinician", "/admin", "/compliance", "/auditor", "/super"];

/** Auth pages — a signed-in user is bounced away from these to their dashboard. */
const AUTH_PAGES = ["/login", "/staff-login", "/super-login"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = await verifySession(token);

  const protectedPrefix = PROTECTED_PREFIXES.find(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (protectedPrefix) {
    // Not signed in → send to login, remembering where they wanted to go.
    if (!claims) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = `?next=${encodeURIComponent(pathname)}`;
      return NextResponse.redirect(url);
    }
    // Signed in but reaching into another role's section → bounce home.
    if (ROLE_PREFIX[claims.role] !== protectedPrefix) {
      const url = req.nextUrl.clone();
      url.pathname = roleHome(claims.role);
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Already signed in and visiting a login page → skip straight to dashboard.
  if (claims && AUTH_PAGES.includes(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = roleHome(claims.role);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except API routes, Next internals, and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
