import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { verifySession, roleHome, SESSION_COOKIE } from "@/lib/auth";
import { HeaderUserMenu } from "./header-user-menu";

const NAV = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/hipaa", label: "Compliance" },
  { href: "/contact", label: "Contact" },
];

/**
 * Shared public-site top bar — used by the landing page and marketing pages.
 * Reads the session cookie: a signed-in visitor sees their profile menu, an
 * anonymous visitor sees the Sign in / Get started actions.
 */
export async function SiteHeader() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)]/60 bg-[var(--color-background)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-6">
        <Link href="/" aria-label="HealthSecure home">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
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
      </div>
    </header>
  );
}
