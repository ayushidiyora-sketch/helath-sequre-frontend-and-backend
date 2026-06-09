import { Plug, KeyRound, Flag, Layers, Save } from "lucide-react";
import { Input, Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionButton } from "@/components/shared/action-button";
import { TiersTab } from "./tiers-tab";

const flags = [
  { name: "fhir_export_api", desc: "Enable FHIR-compliant export endpoints", tier: "Enterprise", on: true },
  { name: "telehealth_video", desc: "Embedded telehealth video (beta)", tier: "Pro+", on: false },
  { name: "sms_reminders", desc: "Twilio-backed SMS reminder pipeline", tier: "All", on: true },
  { name: "passkey_webauthn", desc: "WebAuthn / passkey enrollment", tier: "All", on: true },
  { name: "consent_re_consent_campaigns", desc: "Bulk re-consent flow", tier: "Pro+", on: true },
  { name: "phi_export_v2", desc: "New right-of-access export with FHIR bundle", tier: "All", on: false },
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
            <TiersTab />
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
