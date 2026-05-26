import { Plug, KeyRound, Flag, Layers, Save, Zap, Crown, CheckCircle2, Building2, type LucideIcon } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionButton } from "@/components/shared/action-button";
import { EditTierDialog } from "./edit-tier-dialog";

const flags = [
  { name: "fhir_export_api", desc: "Enable FHIR-compliant export endpoints", tier: "Enterprise", on: true },
  { name: "telehealth_video", desc: "Embedded telehealth video (beta)", tier: "Pro+", on: false },
  { name: "sms_reminders", desc: "Twilio-backed SMS reminder pipeline", tier: "All", on: true },
  { name: "passkey_webauthn", desc: "WebAuthn / passkey enrollment", tier: "All", on: true },
  { name: "consent_re_consent_campaigns", desc: "Bulk re-consent flow", tier: "Pro+", on: true },
  { name: "phi_export_v2", desc: "New right-of-access export with FHIR bundle", tier: "All", on: false },
];

interface TierSpec {
  name: string;
  price: string;
  interval: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  users: string;
  storage: string;
  tenants: number;
  highlight?: boolean;
  badge?: string;
  features: string[];
}

const TIERS: TierSpec[] = [
  {
    name: "Basic",
    price: "$99",
    interval: "/ mo",
    description: "For small clinics getting started with a secure patient portal.",
    icon: Layers,
    accent: "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]",
    users: "10",
    storage: "5 GB",
    tenants: 6,
    features: [
      "Email & in-app notifications",
      "Append-only audit ledger",
      "Daily backups · 7-day PITR",
      "Business-hours support",
    ],
  },
  {
    name: "Pro",
    price: "$399",
    interval: "/ mo",
    description: "For growing multi-clinic operations and clinical networks.",
    icon: Zap,
    accent: "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_170)]",
    users: "50",
    storage: "100 GB",
    tenants: 9,
    highlight: true,
    badge: "Most popular",
    features: [
      "Everything in Basic",
      "SMS reminder pipeline (Twilio)",
      "Scheduled reports & PDF exports",
      "WebAuthn / passkey enrollment",
      "Priority email support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    interval: "",
    description: "For hospitals and regulated networks with bespoke compliance needs.",
    icon: Crown,
    accent: "from-[oklch(0.7_0.15_25)] to-[oklch(0.55_0.14_350)]",
    users: "Unlimited",
    storage: "Custom",
    tenants: 3,
    features: [
      "Everything in Pro",
      "Multi-AZ deployment",
      "Cross-region S3 replication",
      "Customer-managed KMS keys",
      "Custom SMTP & SAML SSO",
      "24/7 dedicated support",
    ],
  },
];

export default function PlatformConfigPage() {
  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Configuration"
        description="Manage subscription tiers, feature flags, and platform-level defaults that propagate to all tenants."
        actions={
          <ActionButton
            size="sm"
            toastMessage="Platform changes saved"
            toastDescription="Propagating to all 18 tenants · audit-logged"
          >
            <Save /> Save changes
          </ActionButton>
        }
      />

      <Tabs defaultValue="flags">
        <TabsList>
          <TabsTrigger value="flags"><Flag /> Feature flags</TabsTrigger>
          <TabsTrigger value="tiers"><Layers /> Tiers</TabsTrigger>
          <TabsTrigger value="defaults"><KeyRound /> Defaults</TabsTrigger>
          <TabsTrigger value="integrations"><Plug /> Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="flags">
          <div className="space-y-2">
            {flags.map((f) => (
              <div key={f.name} className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold font-mono">{f.name}</p>
                    <Badge variant="muted" size="sm">{f.tier}</Badge>
                  </div>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">{f.desc}</p>
                </div>
                <Switch defaultChecked={f.on} />
              </div>
            ))}
          </div>
        </TabsContent>

          <TabsContent value="tiers">
            <div className="grid gap-5 md:grid-cols-3 md:items-stretch">
              {TIERS.map((t) => {
                const Icon: LucideIcon = t.icon;
                return (
                  <div
                    key={t.name}
                    className={`relative flex flex-col rounded-2xl border bg-[var(--color-card)] p-6 transition-all ${
                      t.highlight
                        ? "border-[var(--color-primary)] shadow-[var(--shadow-lift)] ring-1 ring-[var(--color-primary)]/25"
                        : "border-[var(--color-border)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]"
                    }`}
                  >
                    {t.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--color-primary)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white shadow-[var(--shadow-soft)]">
                        {t.badge}
                      </span>
                    )}

                    {/* Header */}
                    <div className="flex items-center gap-3">
                      <span className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br ${t.accent} text-white shadow-[var(--shadow-soft)]`}>
                        <Icon className="size-5" />
                      </span>
                      <div>
                        <p className="text-base font-semibold">{t.name}</p>
                        <p className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted-foreground)]">
                          <Building2 className="size-3" /> {t.tenants} tenants on this tier
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                      {t.description}
                    </p>

                    {/* Price */}
                    <div className="mt-5 flex items-baseline gap-1.5">
                      <span className="bg-gradient-to-br from-[var(--color-foreground)] to-[var(--color-muted-foreground)] bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
                        {t.price}
                      </span>
                      {t.interval && (
                        <span className="text-sm text-[var(--color-muted-foreground)]">{t.interval}</span>
                      )}
                    </div>

                    {/* Specs */}
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Users</p>
                        <p className="mt-0.5 text-sm font-semibold">{t.users}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Storage</p>
                        <p className="mt-0.5 text-sm font-semibold">{t.storage}</p>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="mt-4 space-y-2 text-xs">
                      {t.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-success)]" />
                          <span className="text-[var(--color-foreground)]">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Edit */}
                    <div className="mt-auto pt-5">
                      <EditTierDialog
                        tier={{
                          name: t.name,
                          price: t.interval ? `${t.price} ${t.interval}` : t.price,
                          users: t.users,
                          storage: t.storage,
                          features: t.features.join(" · "),
                        }}
                      />
                    </div>
                  </div>  
                );
              })}
            </div>
          </TabsContent>

        <TabsContent value="defaults">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Min password length (platform floor)</Label><Input defaultValue="12" type="number" /></div>
              <div className="space-y-1.5"><Label>Min session timeout (platform floor)</Label><Input defaultValue="30 min" /></div>
              <div className="space-y-1.5"><Label>Audit retention minimum</Label><Input defaultValue="6 years" /></div>
              <div className="space-y-1.5"><Label>MFA enforcement</Label><Input defaultValue="Mandatory for clinical + admin roles" readOnly className="bg-[var(--color-muted)]" /></div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { k: "SendGrid", slug: "sendgrid", desc: "Platform SMTP fallback · API key configured", on: true },
              { k: "Twilio SMS", slug: "twilio", desc: "Default SMS gateway · 6 sender IDs", on: true },
              { k: "Datadog APM", slug: "datadog", desc: "Application performance monitoring", on: true },
              { k: "AWS KMS", slug: "aws-kms", desc: "Customer-managed keys per tenant", on: true },
            ].map((i) => (
              <div key={i.k} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{i.k}</p>
                  <Switch defaultChecked={i.on} />
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{i.desc}</p>
                <ActionButton variant="outline" size="sm" className="mt-3" href={`/super/platform/integrations/${i.slug}`}>
                  Configure
                </ActionButton>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
