"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  ScrollText,
  Shield,
  FileBarChart2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Clock,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";

interface AuditorProfile {
  name: string;
  email: string;
  organization: string;
  scope: string;
  accountExpiresLabel: string;
  mfaEnrolled: boolean;
  sessionIpAllowlist: string | null;
}

interface Stats {
  events24h?: number;
  activeConsents?: number;
  openAnomalies?: number;
  generatedReports?: number;
}

export default function AuditorDashboard() {
  const [profile, setProfile] = useState<AuditorProfile | null>(null);
  const [stats, setStats] = useState<Stats>({});

  useEffect(() => {
    let alive = true;
    fetch("/api/auditor/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive && data?.ok) setProfile(data.profile); })
      .catch(() => {});
    fetch("/api/compliance/audit-logs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.ok && typeof data.stats?.events24h === "number") {
          setStats((s) => ({ ...s, events24h: data.stats.events24h }));
        }
      })
      .catch(() => {});
    fetch("/api/compliance/consents", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.ok && typeof data.stats?.active === "number") {
          setStats((s) => ({ ...s, activeConsents: data.stats.active }));
        }
      })
      .catch(() => {});
    fetch("/api/compliance/anomalies", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.ok && typeof data.stats?.open === "number") {
          setStats((s) => ({ ...s, openAnomalies: data.stats.open }));
        }
      })
      .catch(() => {});
    fetch("/api/auditor/report-exports", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.ok && typeof data.count === "number") {
          setStats((s) => ({ ...s, generatedReports: data.count }));
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const orgLabel = profile?.organization ?? "—";
  const expiresLabel = profile?.accountExpiresLabel ?? "—";

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[oklch(0.96_0.025_250)] p-6 sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-gradient-to-br from-[oklch(0.65_0.08_250)] to-transparent opacity-20 blur-3xl" />
        <div className="relative grid gap-5 sm:grid-cols-[1.4fr_1fr] sm:items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted-foreground)]">
              <Eye className="size-3" /> Strictly read-only · session bounded
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Auditor overview · {orgLabel}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm text-[var(--color-muted-foreground)]">
              Your account expires automatically on{" "}
              <span className="font-medium text-[var(--color-foreground)]">{expiresLabel}</span>.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ActionButton size="sm" href="/auditor/audit-logs">
                <ScrollText /> Open ledger
              </ActionButton>
              <ActionButton variant="outline" size="sm" href="/auditor/reports">
                <Download /> Export
              </ActionButton>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-soft)]">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted-foreground)]">Your access</p>
            <div className="mt-3 space-y-1.5 text-xs">
              <Row label="Scope" value={profile?.scope ?? "—"} mono />
              <Row label="Role" value="Auditor (read-only)" />
              <Row label="MFA" value={profile?.mfaEnrolled ? "TOTP active" : "Not enrolled"} />
              <Row label="Last session IP" value={profile?.sessionIpAllowlist ?? "—"} mono />
              <Row label="Account expires" value={expiresLabel} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Audit events / 24h", value: stats.events24h?.toLocaleString() ?? "—", icon: ScrollText },
          { label: "Active consents", value: stats.activeConsents?.toLocaleString() ?? "—", icon: Shield },
          { label: "Generated reports", value: stats.generatedReports?.toLocaleString() ?? "—", icon: FileBarChart2 },
          { label: "Open anomalies", value: stats.openAnomalies?.toLocaleString() ?? "—", icon: AlertTriangle, warn: (stats.openAnomalies ?? 0) > 0 },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
                <Icon className={`size-3.5 ${s.warn ? "text-[var(--color-warning)]" : ""}`} /> {s.label}
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-semibold">What you can do</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <Capability icon={CheckCircle2} ok>Read the full audit ledger for {orgLabel}</Capability>
            <Capability icon={CheckCircle2} ok>Read consent records (no PHI body)</Capability>
            <Capability icon={CheckCircle2} ok>Download read-only reports (PDF)</Capability>
            <Capability icon={Lock}>Modify any record — strictly blocked</Capability>
            <Capability icon={Lock}>See PHI body content — out of scope</Capability>
            <Capability icon={Clock}>Persist sessions — auto-revoked at expiry</Capability>
          </ul>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h2 className="text-sm font-semibold">Audit guardrails</h2>
          <ul className="mt-3 space-y-2 text-xs text-[var(--color-muted-foreground)]">
            <li className="flex items-start gap-2"><Shield className="mt-0.5 size-3.5" /> Every read is audit-logged against your session id.</li>
            <li className="flex items-start gap-2"><Lock className="mt-0.5 size-3.5" /> Exports require an explicit click + reason.</li>
            <li className="flex items-start gap-2"><Eye className="mt-0.5 size-3.5" /> No write surface available anywhere in your account.</li>
          </ul>
          <div className="mt-3"><SecurityBadge variant="audited" /></div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className={mono ? "font-mono" : ""}>{value}</span>
    </div>
  );
}

function Capability({
  icon: Icon,
  children,
  ok,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <li className="flex items-start gap-2">
      <Icon className={`mt-0.5 size-4 ${ok ? "text-[var(--color-success)]" : "text-[var(--color-muted-foreground)]"}`} />
      <span className={ok ? "" : "text-[var(--color-muted-foreground)]"}>{children}</span>
    </li>
  );
}
