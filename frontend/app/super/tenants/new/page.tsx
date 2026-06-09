"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Globe,
  Mail,
  Plug,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RegionPicker } from "./region-picker";

const TYPES = ["Clinic", "Hospital", "Diagnostic", "Telemedicine"] as const;

interface IntegrationDef {
  key: "sendgrid" | "twilioSms" | "clamav" | "customSmtp";
  label: string;
  hint: string;
}

const INTEGRATIONS: IntegrationDef[] = [
  { key: "sendgrid", label: "SendGrid", hint: "Send welcome + OTP via SendGrid" },
  { key: "twilioSms", label: "Twilio SMS", hint: "Send OTP via Twilio SMS instead of email" },
  { key: "clamav", label: "ClamAV virus scan", hint: "Scan uploaded files for malware" },
  { key: "customSmtp", label: "Custom SMTP", hint: "Send via your own SMTP_* env vars" },
];

function slugifyId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return slug ? `org_${slug}` : "";
}

export default function ProvisionTenantPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [idDirty, setIdDirty] = useState(false);
  const [id, setId] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("Clinic");
  const [region, setRegion] = useState("ap-south-1");
  const [multiAz, setMultiAz] = useState(true);
  const [s3Replication, setS3Replication] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  // Per-tenant integration toggles. The welcome email path picks its transport
  // from these flags (see app/api/super/tenants/route.ts).
  const [integrations, setIntegrations] = useState<Record<IntegrationDef["key"], boolean>>({
    sendgrid: false,
    twilioSms: false,
    clamav: false,
    customSmtp: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const computedId = useMemo(() => (idDirty ? id : slugifyId(name)), [idDirty, id, name]);

  function handleNameChange(v: string) {
    setName(v);
    if (!idDirty) setId(slugifyId(v));
  }

  async function handleProvision() {
    setError(null);
    if (!name.trim()) {
      setError("Tenant name is required.");
      return;
    }
    if (!adminName.trim() || !adminEmail.trim()) {
      setError("Org Admin name and email are required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/super/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          id: computedId,
          type,
          region,
          multiAz,
          s3Replication,
          contact: {
            email: contactEmail.trim(),
            phone: contactPhone.trim(),
            address: contactAddress.trim(),
          },
          adminName: adminName.trim(),
          adminEmail: adminEmail.trim(),
          integrations,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not provision tenant.");
        setSubmitting(false);
        return;
      }

      if (data.mailSent) {
        const via = typeof data.mailVia === "string" ? data.mailVia : "mail";
        toast.success(`Tenant ${data.tenant.id} provisioned`, {
          description: `Welcome ${via === "twilio" ? "SMS" : "email"} sent via ${via} to ${adminEmail.trim()} · audit-logged`,
        });
      } else {
        // Show every transport that was tried, in order, so the user can see
        // (e.g.) that SendGrid was attempted and rejected before falling
        // through to Resend — instead of just the last failure.
        const attempts = Array.isArray(data.mailAttempts) ? data.mailAttempts : [];
        const attemptsSummary = attempts.length
          ? attempts
              .map(
                (a: { via: string; outcome: string; error?: string }) =>
                  `• ${a.via}: ${a.outcome === "ok" ? "sent" : a.outcome === "skipped" ? "skipped (no creds)" : (a.error ?? "failed").slice(0, 110)}`,
              )
              .join("\n")
          : data.mailError ?? "No mail transport configured";
        const pw =
          data.devCredentials && typeof data.devCredentials.password === "string"
            ? `\n\nTemp password (share out-of-band): ${data.devCredentials.password}`
            : "";
        toast.warning(`Tenant ${data.tenant.id} provisioned — email NOT delivered`, {
          description: `${attemptsSummary}${pw}`,
          duration: 22000,
        });
      }
      router.push("/super/tenants");
      router.refresh();
    } catch {
      setError("Network error — could not reach the server.");
      setSubmitting(false);
    }
  }

  const adminPreview = adminEmail
    ? adminEmail.length > 22
      ? `${adminEmail.slice(0, 19)}…`
      : adminEmail
    : "admin@…";

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/super/tenants"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Tenants
        </Link>
        <span>/</span>
        <span>Provision new</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Provision a new tenant</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          This creates an isolated row-level tenant + an Org Admin account.
          Sign-in credentials are emailed to the admin immediately.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          {/* Identity */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Building2 className="size-4" /> Identity
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Tenant name</Label>
                <Input
                  placeholder="e.g., Lakeside Pediatric Clinic"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tenant ID</Label>
                <Input
                  value={computedId}
                  onChange={(e) => {
                    setId(e.target.value);
                    setIdDirty(true);
                  }}
                  placeholder="org_lakeside"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
              New tenants start on Basic. The plan is set when the Org Admin subscribes from the pricing page.
            </p>
          </div>

          {/* Organization contact */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Mail className="size-4" /> Organization contact
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Contact email</Label>
                <Input
                  type="email"
                  placeholder="billing@lakeside.health"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  placeholder="+1 555 0100"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input
                  placeholder="123 Care St, Suite 200, City, Country"
                  value={contactAddress}
                  onChange={(e) => setContactAddress(e.target.value)}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
              Optional. Pre-fills the tenant&apos;s Organization Profile and billing details.
            </p>
          </div>

          {/* Region + infra */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Globe className="size-4" /> Region & infrastructure
            </h2>
            <RegionPicker value={region} onChange={setRegion} />
            <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-xs">
              <span>Enable multi-AZ DB</span>
              <Switch checked={multiAz} onCheckedChange={setMultiAz} />
            </div>
            <div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-xs">
              <span>Cross-region S3 replication</span>
              <Switch checked={s3Replication} onCheckedChange={setS3Replication} />
            </div>
          </div>

          {/* Integrations */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Plug className="size-4" /> Integrations
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {INTEGRATIONS.map((i) => (
                <div
                  key={i.key}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{i.label}</p>
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted-foreground)]">
                      {i.hint}
                    </p>
                  </div>
                  <Switch
                    checked={integrations[i.key]}
                    onCheckedChange={(v) =>
                      setIntegrations((prev) => ({ ...prev, [i.key]: v }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {/* First admin */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Mail className="size-4" /> First Org Admin invitation
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input
                  placeholder="Jane Doe"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="admin@lakeside.health"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
              A welcome email containing the temporary sign-in password is sent immediately.
              The admin should change it on first sign-in.
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Provisioning summary
            </p>
            <dl className="mt-3 space-y-2 text-xs">
              <Row label="Tenant ID" value={computedId || "—"} mono />
              <Row label="Region" value={region} />
              <Row label="Multi-AZ" value={multiAz ? "Yes" : "No"} />
              {contactEmail.trim() && <Row label="Contact" value={contactEmail.trim()} />}
              <Row label="First admin" value={adminPreview} />
            </dl>
            <Button
              type="button"
              className="mt-4 w-full"
              onClick={handleProvision}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> Provisioning…
                </>
              ) : (
                <>
                  Provision tenant <ArrowRight />
                </>
              )}
            </Button>
            <Button asChild variant="outline" className="mt-2 w-full" disabled={submitting}>
              <Link href="/super/tenants">Cancel</Link>
            </Button>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              What gets created
            </p>
            <ul className="mt-3 space-y-2 text-[var(--color-muted-foreground)]">
              <li className="flex gap-2">
                <CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" />
                Isolated row-level tenant + PostgreSQL RLS
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" />
                Dedicated S3 prefix + KMS key
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" />
                Seed roles, default consent policy v2.4
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" />
                Org Admin welcome email with sign-in credentials
              </li>
            </ul>
            <div className="mt-3">
              <Badge variant="muted" size="sm">
                <ShieldCheck className="size-3" /> Provisioning is audit-logged
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[var(--color-muted-foreground)]">{label}</span>
      <span className={`font-medium text-right ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
