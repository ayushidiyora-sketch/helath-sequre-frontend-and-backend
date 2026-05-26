import Link from "next/link";
import { ShieldCheck, Lock, ScrollText } from "lucide-react";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Left panel — content */}
      <div className="relative flex min-h-screen flex-col bg-[var(--color-background)] px-6 py-8 sm:px-10 lg:px-14">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] mesh-bg opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

        <div className="relative flex items-center justify-between">
          <Link href="/" aria-label="HealthSecure home">
            <Logo />
          </Link>
          <Link
            href="/"
            className="text-xs font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            ← Back to overview
          </Link>
        </div>

        <div className="relative my-auto flex flex-col items-center py-16">
          <div className="w-full max-w-md">{children}</div>
        </div>

        <p className="relative text-center text-[11px] text-[var(--color-muted-foreground)]">
          By using HealthSecure Portal you agree to the{" "}
          <Link href="#" className="underline-offset-2 hover:underline">Terms</Link> and{" "}
          <Link href="#" className="underline-offset-2 hover:underline">Privacy Policy</Link>.
        </p>
      </div>

      {/* Right panel — illustrative */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[oklch(0.32_0.07_205)] via-[oklch(0.22_0.05_215)] to-[oklch(0.18_0.04_230)] lg:block">
        <div className="absolute inset-0 grid-bg opacity-[0.07]" />
        <div className="absolute -left-32 top-1/3 size-96 rounded-full bg-[oklch(0.65_0.16_195)] opacity-30 blur-[120px]" />
        <div className="absolute -right-24 bottom-12 size-96 rounded-full bg-[oklch(0.7_0.16_158)] opacity-30 blur-[120px]" />

        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium backdrop-blur w-fit">
            <span className="size-2 rounded-full bg-[oklch(0.78_0.18_158)]" />
            HIPAA · GDPR · SOC 2 readiness
          </div>

          <div className="space-y-6">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">
              Security that disappears into the workflow.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-white/70">
              Mandatory MFA for clinical roles, signed time-limited invitation
              tokens, and an append-only audit ledger sit underneath every
              authenticated request — invisible until you need them.
            </p>
            <div className="space-y-3 pt-4">
              {[
                { icon: ShieldCheck, t: "Consent-bound by default", b: "PHI access denied unless an active consent permits the read." },
                { icon: Lock, t: "Encrypted everywhere", b: "TLS 1.3, AES-256 at rest, column-level encryption for the most sensitive fields." },
                { icon: ScrollText, t: "Tamper-evident audit", b: "Append-only ledger, rolling checksums, six-year retention." },
              ].map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.t} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{row.t}</p>
                      <p className="mt-0.5 text-xs text-white/65">{row.b}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-white/55">
            <span>© 2026 Sensussoft Software Pvt Ltd</span>
            <span className="font-mono">build · 1.0.0-rc</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
