import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  MessageSquare,
  Activity,
  KeyRound,
  Save,
  ShieldCheck,
  Plug,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/shared/action-button";

interface Field {
  label: string;
  value: string;
  type?: string;
  mono?: boolean;
  readOnly?: boolean;
  hint?: string;
}
interface Toggle {
  label: string;
  desc: string;
  on: boolean;
}
interface Integration {
  name: string;
  category: string;
  icon: LucideIcon;
  description: string;
  status: string;
  fields: Field[];
  toggles: Toggle[];
}

/** Platform integration configurations (mock — wired to Save toast). */
const INTEGRATIONS: Record<string, Integration> = {
  sendgrid: {
    name: "SendGrid",
    category: "Email delivery",
    icon: Mail,
    description:
      "Transactional email — invitations, OTP, appointment reminders, and notifications. Acts as the platform SMTP fallback for every tenant.",
    status: "Connected",
    fields: [
      { label: "API key", value: "SG.••••••••••••••••3a91", mono: true, hint: "Stored in AWS Secrets Manager — rotate every 90 days." },
      { label: "Verified sender domain", value: "mail.healthsecure.io" },
      { label: "Default from address", value: "no-reply@healthsecure.io", type: "email" },
      { label: "Daily send cap (platform)", value: "250000", type: "number" },
    ],
    toggles: [
      { label: "Use as SMTP fallback", desc: "Route tenant email through SendGrid when a tenant's own SMTP fails.", on: true },
      { label: "Click & open tracking", desc: "Append SendGrid tracking pixels (keep off for stricter privacy).", on: false },
    ],
  },
  twilio: {
    name: "Twilio SMS",
    category: "SMS gateway",
    icon: MessageSquare,
    description:
      "Default SMS gateway for appointment reminders and OTP delivery wherever a tenant enables the SMS channel.",
    status: "Connected",
    fields: [
      { label: "Account SID", value: "AC••••••••••••••••••••f2", mono: true },
      { label: "Auth token", value: "••••••••••••••••••••••••", mono: true, hint: "Stored in AWS Secrets Manager — never exposed to tenants." },
      { label: "Messaging Service SID", value: "MG••••••••••••••••••••7d", mono: true },
      { label: "Default sender ID", value: "HEALTHSEC" },
    ],
    toggles: [
      { label: "SMS reminder pipeline", desc: "Enable the Twilio-backed reminder queue for opted-in tenants.", on: true },
      { label: "Delivery-status webhooks", desc: "Track sent / delivered / failed status per message.", on: true },
    ],
  },
  datadog: {
    name: "Datadog APM",
    category: "Monitoring",
    icon: Activity,
    description:
      "Application performance monitoring and security telemetry across the whole platform.",
    status: "Connected",
    fields: [
      { label: "API key", value: "dd_••••••••••••••••91c", mono: true },
      { label: "Application key", value: "dd_app_••••••••••••4f", mono: true },
      { label: "Site / region", value: "us5.datadoghq.com" },
      { label: "Trace sample rate", value: "20%" },
    ],
    toggles: [
      { label: "APM tracing", desc: "Distributed request tracing across API and worker tiers.", on: true },
      { label: "Security signals forwarding", desc: "Forward auth anomalies and rate-limit breaches to Datadog.", on: true },
      { label: "Log forwarding", desc: "Ship PHI-redacted application logs to Datadog.", on: false },
    ],
  },
  "aws-kms": {
    name: "AWS KMS",
    category: "Encryption",
    icon: KeyRound,
    description:
      "Customer-managed encryption keys — one CMK per tenant for column-level PHI encryption and S3 document storage.",
    status: "Connected",
    fields: [
      { label: "Default key ARN", value: "arn:aws:kms:ap-south-1:…:key/hs-platform", mono: true, readOnly: true },
      { label: "Region", value: "ap-south-1" },
      { label: "Key rotation period", value: "365 days" },
    ],
    toggles: [
      { label: "Per-tenant CMK", desc: "Provision a dedicated customer-managed key for each new tenant.", on: true },
      { label: "Automatic annual rotation", desc: "Let AWS KMS rotate the key material every 365 days.", on: true },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(INTEGRATIONS).map((slug) => ({ slug }));
}

export default async function IntegrationConfigPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const integration = INTEGRATIONS[slug];
  if (!integration) notFound();

  const Icon = integration.icon;

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link
          href="/super/platform"
          className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft className="size-3.5" /> Configuration
        </Link>
        <span>/</span>
        <span className="inline-flex items-center gap-1.5">
          <Plug className="size-3.5" /> Integrations
        </span>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">{integration.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
          <Icon className="size-6" />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{integration.name}</h1>
            <Badge variant="success" size="sm" dot>
              {integration.status}
            </Badge>
            <Badge variant="muted" size="sm">
              {integration.category}
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted-foreground)]">
            {integration.description}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          {/* Connection */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <KeyRound className="size-4" /> Connection
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {integration.fields.map((f) => (
                <div key={f.label} className="space-y-1.5">
                  <Label>{f.label}</Label>
                  <Input
                    defaultValue={f.value}
                    type={f.type ?? "text"}
                    readOnly={f.readOnly}
                    className={`${f.mono ? "font-mono text-xs" : ""} ${
                      f.readOnly ? "bg-[var(--color-muted)]" : ""
                    }`}
                  />
                  {f.hint && (
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">{f.hint}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Behaviour */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
              <Plug className="size-4" /> Behaviour
            </h2>
            <div className="mt-4 space-y-2">
              {integration.toggles.map((t) => (
                <div
                  key={t.label}
                  className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">{t.desc}</p>
                  </div>
                  <Switch defaultChecked={t.on} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side actions */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Actions
            </p>
            <div className="mt-3 space-y-2">
              <ActionButton
                className="w-full"
                toastMessage={`${integration.name} settings saved`}
                toastDescription="Propagating to all 18 tenants · audit-logged"
              >
                <Save /> Save changes
              </ActionButton>
              <ActionButton
                variant="outline"
                className="w-full"
                toastMessage={`Testing ${integration.name} connection…`}
                toastDescription="Sent a test request — check the result toast."
                toastVariant="info"
              >
                Test connection
              </ActionButton>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/super/platform">Cancel</Link>
              </Button>
            </div>
            <ActionButton
              variant="ghost"
              size="sm"
              className="mt-3 w-full text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
              confirm={{
                title: `Disconnect ${integration.name}?`,
                description:
                  "Tenants relying on this integration will fall back to platform defaults until it is reconnected. This action is audit-logged.",
                confirmLabel: "Disconnect",
                variant: "destructive",
              }}
              toastMessage={`${integration.name} disconnected`}
              toastDescription="Audit-logged · tenants notified"
              toastVariant="warning"
            >
              Disconnect integration
            </ActionButton>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <Badge variant="muted" size="sm">
              <ShieldCheck className="size-3" /> Changes are audit-logged
            </Badge>
            <p className="mt-3 text-[var(--color-muted-foreground)]">
              Credentials are stored in AWS Secrets Manager and never exposed to tenant
              administrators. Updates propagate platform-wide within a few minutes.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
