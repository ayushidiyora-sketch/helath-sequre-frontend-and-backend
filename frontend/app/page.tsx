import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ShieldCheck,
  Lock,
  ScrollText,
  Stethoscope,
  Users,
  ClipboardList,
  KeyRound,
  Sparkles,
  CheckCircle2,
  FileLock2,
  Activity,
  HeartHandshake,
  Building2,
  UserCircle2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SecurityBadge } from "@/components/shared/security-badge";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { ClientMarquee } from "@/components/marketing/client-marquee";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-background)]">
      {/* Background mesh */}
      <div className="pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[600px] grid-bg opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      <SiteHeader />
      <Hero />
      <ClientMarquee />
      <FeatureGrid />
      <ClinicalBand />
      <RoleGrid />
      <AuditShowcase />
      <CTASection />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative mesh-bg">
      <div className="mx-auto max-w-7xl px-5 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-24 lg:pt-32">
        <div className="grid min-w-0 items-center gap-10 sm:gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div className="flex min-w-0 flex-col gap-5 sm:gap-7">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/70 px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)] backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-success)]" />
              </span>
              HIPAA · GDPR · HL7/FHIR-ready
            </div>

            <h1 className="text-3xl font-semibold leading-[1.1] tracking-tight text-[var(--color-foreground)] [text-wrap:balance] [overflow-wrap:anywhere] sm:text-4xl sm:leading-[1.05] md:text-5xl lg:text-[3.5rem]">
              A patient portal where every PHI access is{" "}
              <span className="bg-gradient-to-r from-[var(--color-primary)] to-[oklch(0.52_0.14_240)] bg-clip-text text-transparent">
                consented, encrypted, and audited
              </span>
              .
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-[var(--color-muted-foreground)] sm:text-lg">
              HealthSecure Portal is a compliance-first patient portal for clinics,
              hospitals, and telemedicine providers. Built on a zero-trust permission
              model with append-only audit trails and granular consent capture.
            </p>

            <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:pt-2">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/register">
                  Start as a patient <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/staff-login">Clinician sign-in</Link>
              </Button>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 sm:mt-3">
              <SecurityBadge variant="encrypted" />
              <SecurityBadge variant="audited" />
              <SecurityBadge variant="consent-bound" />
              <SecurityBadge variant="mfa" />
            </div>
          </div>

          <HeroVisual />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative min-w-0">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-[oklch(0.92_0.05_205)] via-transparent to-[oklch(0.92_0.05_240)] blur-2xl" />

      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-lift)]">
        {/* Mock chrome */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-muted)]/50 px-3 py-2.5 sm:px-4">
          <div className="flex shrink-0 gap-1.5">
            <span className="size-2.5 rounded-full bg-[oklch(0.78_0.13_22)]" />
            <span className="size-2.5 rounded-full bg-[oklch(0.82_0.13_85)]" />
            <span className="size-2.5 rounded-full bg-[oklch(0.78_0.1_220)]" />
          </div>
          <div className="flex min-w-0 items-center gap-2 rounded-md bg-[var(--color-card)] px-3 py-1 text-[11px] font-mono text-[var(--color-muted-foreground)]">
            <Lock className="size-3 shrink-0" />
            <span className="truncate">portal.healthsecure.app/patient/dashboard</span>
          </div>
          <div className="hidden w-8 shrink-0 sm:block" />
        </div>

        {/* Mock dashboard preview */}
        <div className="grid grid-cols-12 gap-3 p-4 sm:p-5">
          <div className="col-span-12 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                Good morning
              </p>
              <p className="truncate text-base font-semibold">Aarav Mehta</p>
            </div>
            <SecurityBadge variant="audited" />
          </div>

          <div className="col-span-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 sm:col-span-7">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--color-muted-foreground)]">Next appointment</p>
              <Badge variant="info" size="sm" dot>
                Confirmed
              </Badge>
            </div>
            <p className="mt-2 text-sm font-semibold">Dr. Priya Shah · Cardiology</p>
            <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
              <span className="inline-flex items-center gap-1">
                <Activity className="size-3.5" /> Mon, May 25
              </span>
              <span className="inline-flex items-center gap-1">
                <Stethoscope className="size-3.5" /> 9:30 AM · Room 304
              </span>
            </div>
          </div>

          <div className="col-span-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4 sm:col-span-5">
            <p className="text-xs font-medium text-[var(--color-muted-foreground)]">Active consents</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-2xl font-semibold">4</span>
              <span className="pb-1 text-xs text-[var(--color-muted-foreground)]">/ 5 granted</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-muted)]">
              <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[oklch(0.62_0.12_185)]" />
            </div>
          </div>

          <div className="col-span-12 rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium text-[var(--color-muted-foreground)]">Recent records</p>
              <p className="text-[11px] text-[var(--color-primary-700)]">View all →</p>
            </div>
            <div className="space-y-2">
              {[
                { icon: FileLock2, t: "Lipid panel — May 18", b: "Dr. Shah", v: "verified" as const },
                { icon: ClipboardList, t: "Discharge summary", b: "City General", v: "encrypted" as const },
                { icon: Eye, t: "Imaging — Chest X-ray", b: "Radiology", v: "consent-bound" as const },
              ].map((row, i) => {
                const Icon = row.icon;
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-2.5">
                    <span className="flex size-8 items-center justify-center rounded-md bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                      <Icon className="size-4" />
                    </span>
                    <div className="flex-1">
                      <p className="text-xs font-medium">{row.t}</p>
                      <p className="text-[10px] text-[var(--color-muted-foreground)]">{row.b}</p>
                    </div>
                    <SecurityBadge variant={row.v} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Floating audit pill */}
      <div className="absolute -bottom-6 -left-6 hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 pr-4 shadow-[var(--shadow-lift)] sm:flex sm:items-center sm:gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-info-soft)] text-[var(--color-info)]">
          <ScrollText className="size-4" />
        </span>
        <div>
          <p className="text-[11px] font-medium text-[var(--color-muted-foreground)]">Last 24h</p>
          <p className="text-sm font-semibold">12,489 audit events</p>
        </div>
      </div>
    </div>
  );
}

function FeatureGrid() {
  const features = [
    {
      icon: ShieldCheck,
      title: "Consent-bound PHI access",
      body: "Every API call passes through a consent-evaluation guard. Patients grant granular scope per clinician × record category × time bound.",
    },
    {
      icon: Lock,
      title: "End-to-end encryption",
      body: "TLS 1.3 in transit, AES-256 at rest, application-level encryption for the most sensitive columns. No PHI in logs — ever.",
    },
    {
      icon: ScrollText,
      title: "Append-only audit ledger",
      body: "Every view, download, edit, and login lands in an immutable ledger with request correlation IDs and tamper-detection checksums.",
    },
    {
      icon: KeyRound,
      title: "MFA + zero-trust sessions",
      body: "Mandatory TOTP for clinical and admin roles, IP allowlists, device tracking, idle timeouts, and rotated refresh tokens.",
    },
    {
      icon: Building2,
      title: "Multi-tenant isolation",
      body: "Tenant-scoped row-level isolation reinforced with PostgreSQL RLS. Cross-tenant access is impossible by default.",
    },
    {
      icon: HeartHandshake,
      title: "Right-of-access ready",
      body: "Patients export their full PHI as PDF/CSV bundles and trigger right-to-be-forgotten flows aligned with HIPAA and GDPR.",
    },
  ];
  return (
    <section id="features" className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
            Platform
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built like critical infrastructure, used like a modern app
          </h2>
          <p className="mt-3 text-[var(--color-muted-foreground)]">
            Every screen, every endpoint, every workflow is designed against the
            HIPAA Security Rule and reviewed for the &quot;could this leak PHI?&quot; question.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
              >
                <div className="mb-5 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-sm transition-transform group-hover:scale-105">
                  <Icon className="size-5" />
                </div>
                <h3 className="text-base font-semibold tracking-tight">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted-foreground)]">{f.body}</p>
                <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--color-primary)]/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ClinicalBand() {
  const stats = [
    { value: "AES-256", label: "Encryption at rest" },
    { value: "< 50 ms", label: "Consent-check latency" },
    { value: "99.9%", label: "Uptime target" },
  ];
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image
          src="/band-home.jpg"
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[oklch(0.19_0.04_235)]/96 via-[oklch(0.19_0.04_235)]/85 to-[oklch(0.19_0.04_235)]/55" />
      </div>

      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-28">
        <div className="max-w-2xl text-white">
          <p className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.82_0.09_205)]">
            Real-world ready
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for real clinical environments
          </h2>
          <p className="mt-3 max-w-xl text-white/70">
            From a busy hospital ward to a single-clinician telehealth practice,
            HealthSecure Portal adapts to how care is actually delivered — without
            ever loosening its grip on protected health information.
          </p>

          <div className="mt-9 grid max-w-lg grid-cols-3 gap-2 sm:gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/15 bg-white/[0.06] p-3 backdrop-blur sm:p-4"
              >
                <p className="text-base font-semibold tracking-tight sm:text-xl">{s.value}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-white/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleGrid() {
  const roles = [
    { icon: UserCircle2, name: "Patient", scope: "Self only", color: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]" },
    { icon: Stethoscope, name: "Clinician", scope: "Assigned patients", color: "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]" },
    { icon: Building2, name: "Org Admin", scope: "Own tenant", color: "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]" },
    { icon: ClipboardList, name: "Compliance", scope: "Audit + metadata", color: "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]" },
    { icon: Eye, name: "Auditor", scope: "Strictly read-only", color: "from-[oklch(0.6_0.06_250)] to-[oklch(0.42_0.04_250)]" },
    { icon: ShieldCheck, name: "Super Admin", scope: "Cross-tenant + break-glass", color: "from-[oklch(0.62_0.18_22)] to-[oklch(0.48_0.16_22)]" },
  ];
  return (
    <section id="roles" className="relative border-y border-[var(--color-border)] bg-[var(--color-card)]/40 py-24 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div className="lg:sticky lg:top-24">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
              For Every Role
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Six roles. One enforcement model.
            </h2>
            <p className="mt-3 text-[var(--color-muted-foreground)]">
              From a patient revoking a consent at 2 AM to a Super Admin running a
              break-glass incident response — every action is shaped by the same
              consent-bound, audit-logged RBAC engine.
            </p>
            <Button asChild className="mt-6">
              <Link href="/register">
                Open the patient portal <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.name}
                  className="group relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]"
                >
                  <div className={`mb-4 flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${r.color} text-white shadow-[var(--shadow-soft)]`}>
                    <Icon className="size-5" />
                  </div>
                  <p className="text-base font-semibold tracking-tight">{r.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">Scope · {r.scope}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function AuditShowcase() {
  const events = [
    { actor: "p.shah@clinic", action: "records.read", res: "rec_4f12a", status: "success", t: "12:04:18 UTC" },
    { actor: "a.mehta@me", action: "consent.revoke", res: "cns_8a90c", status: "success", t: "12:03:51 UTC" },
    { actor: "p.shah@clinic", action: "records.read", res: "rec_4f12a", status: "denied", t: "12:03:52 UTC", reason: "consent_revoked" },
    { actor: "compliance@clinic", action: "report.export", res: "rpt_access_q2", status: "success", t: "11:58:12 UTC" },
    { actor: "auditor@regulator", action: "audit.view", res: "log_window_24h", status: "success", t: "11:42:09 UTC" },
  ];
  return (
    <section id="audit" className="relative py-24 mesh-bg">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-primary-700)]">
              Audit Trail
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Every PHI touch leaves a fingerprint
            </h2>
            <p className="mt-3 text-[var(--color-muted-foreground)]">
              Append-only audit logs capture actor, role, IP, user agent, session,
              and request ID for every state-changing action — across all six
              roles. Auditors can filter, drill down, and export in PDF or CSV.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Tamper-evident with rolling cryptographic checksums",
                "Filterable by actor, action, resource, IP, time window",
                "Exports include checksum manifest for chain-of-custody",
                "Six-year minimum retention aligned with HIPAA",
              ].map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 text-[var(--color-success)]" />
                  <span className="text-[var(--color-muted-foreground)]">{p}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
                  <Sparkles className="size-3.5 text-[var(--color-primary)]" />
                  Live audit stream · org_acme
                </div>
                <Badge variant="success" size="sm" dot>
                  Streaming
                </Badge>
              </div>
              <div className="divide-y divide-[var(--color-border)] font-mono text-xs">
                {events.map((e, i) => (
                  <div key={i} className="flex min-w-0 items-center gap-3 px-4 py-3">
                    <span className="shrink-0 text-[var(--color-muted-foreground)]">{e.t}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--color-foreground)]">{e.actor}</span>
                    <span className="hidden shrink-0 rounded-md bg-[var(--color-muted)] px-1.5 py-0.5 text-[10px] text-[var(--color-foreground)] sm:inline">
                      {e.action}
                    </span>
                    <span className="hidden min-w-0 flex-1 truncate text-[var(--color-muted-foreground)] sm:inline">{e.res}</span>
                    <span className="shrink-0">
                      {e.status === "success" ? (
                        <Badge variant="success" size="sm">ok</Badge>
                      ) : (
                        <Badge variant="danger" size="sm" title={e.reason}>denied</Badge>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 sm:p-14">
          {/* Health background image */}
          <div aria-hidden className="absolute inset-0">
            <Image
              src="/bg-about.jpg"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-card)] via-[var(--color-card)]/85 to-[var(--color-card)]/45" />
          </div>
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-gradient-to-br from-[oklch(0.72_0.13_205)] to-transparent opacity-25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-12 size-72 rounded-full bg-gradient-to-br from-[oklch(0.7_0.13_240)] to-transparent opacity-20 blur-3xl" />

          <div className="relative grid items-center gap-8 sm:grid-cols-[1.4fr_1fr]">
            <div>
              <Users className="size-9 text-[var(--color-primary)]" />
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                Your health data, on your terms.
              </h2>
              <p className="mt-3 max-w-xl text-[var(--color-muted-foreground)]">
                Patients accept an invitation in minutes — set a password, optionally
                enable MFA, and review the active consent policy. From the next
                screen onward, you control who sees what.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <Button asChild size="xl" className="w-full sm:w-auto">
                <Link href="/register">
                  Create patient account <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

