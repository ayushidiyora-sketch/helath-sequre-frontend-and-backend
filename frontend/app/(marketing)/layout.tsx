import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

/** Wraps the public marketing pages with the shared header and footer. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[var(--color-background)]">
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
