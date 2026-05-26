import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { verifySession, roleHome, SESSION_COOKIE } from "@/lib/auth";
import { HeaderUserMenu } from "./header-user-menu";
import { SiteNav, type NavItem } from "./site-nav";

const NAV: NavItem[] = [
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/hipaa", label: "Compliance" },
  { href: "/contact", label: "Contact" },
];

/**
 * Shared public-site top bar — used by the landing page and marketing
 * pages. Reads the session cookie on the server to choose between the
 * authed profile menu and the anonymous sign-in / get-started CTAs.
 * Active-link state and the mobile menu live in `SiteNav` (client).
 */
export async function SiteHeader() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  const dashboardHref = session ? roleHome(session.role) : undefined;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)]/60 bg-[var(--color-background)]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            aria-label="HealthSecure home"
            className="rounded-lg transition-opacity hover:opacity-85"
          >
            <Logo />
          </Link>
          <span
            className="hidden items-center gap-1.5 rounded-full border border-[var(--color-primary)]/15 bg-[var(--color-primary-50)]/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-primary-700)] lg:inline-flex"
            title="HIPAA-aligned · SOC 2 readiness · audit-grade controls"
          >
            <ShieldCheck className="size-3" /> HIPAA · SOC 2
          </span>
        </div>

        <SiteNav items={NAV} authed={!!session} dashboardHref={dashboardHref} />

        {/* Desktop auth slot (mobile equivalents live inside SiteNav's panel). */}
        <div className="hidden items-center gap-2 md:flex">
          {session ? (
            <HeaderUserMenu
              name={session.name}
              email={session.email}
              role={session.role}
              dashboardHref={roleHome(session.role)}
            />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">
                  Get started <ArrowRight />
                </Link>
              </Button>
            </>
          )}
        </div>

        {/* Signed-in mobile compact avatar (below md). */}
        {session && (
          <div className="md:hidden">
            <HeaderUserMenu
              name={session.name}
              email={session.email}
              role={session.role}
              dashboardHref={roleHome(session.role)}
            />
          </div>
        )}
      </div>
    </header>
  );
}
