import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Globe,
  Mail,
  Plug,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ActionButton } from "@/components/shared/action-button";
import { RegionPicker } from "./region-picker";

export default function ProvisionTenantPage() {
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/super/tenants" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Tenants
        </Link>
        <span>/</span>
        <span>Provision new</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Provision a new tenant</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          This creates an isolated row-level tenant + an invitation token for the first Org Admin.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          {/* Identity */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2"><Building2 className="size-4" /> Identity</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Tenant name</Label><Input placeholder="e.g., Lakeside Pediatric Clinic" /></div>
              <div className="space-y-1.5"><Label>Tenant ID</Label><Input defaultValue="org_lakeside" className="font-mono" /></div>
              <div className="space-y-1.5"><Label>Type</Label>
                <select className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15">
                  <option>Clinic</option><option>Hospital</option><option>Diagnostic</option><option>Telemedicine</option>
                </select>
              </div>
              <div className="space-y-1.5"><Label>Subscription tier</Label>
                <select className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15">
                  <option>Basic</option><option>Pro</option><option>Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          {/* Region + infra */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2"><Globe className="size-4" /> Region & infrastructure</h2>
            <RegionPicker />
            <div className="mt-3 flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-xs">
              <span>Enable multi-AZ DB</span>
              <Switch defaultChecked />
            </div>
            <div className="mt-2 flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-xs">
              <span>Cross-region S3 replication</span>
              <Switch />
            </div>
          </div>

          {/* Integrations */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2"><Plug className="size-4" /> Integrations</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { k: "SendGrid", on: true },
                { k: "Twilio SMS", on: false },
                { k: "ClamAV virus scan", on: true },
                { k: "Custom SMTP", on: false },
              ].map((i) => (
                <div key={i.k} className="flex items-center justify-between rounded-xl border border-[var(--color-border)] p-3 text-sm">
                  <span className="font-medium">{i.k}</span>
                  <Switch defaultChecked={i.on} />
                </div>
              ))}
            </div>
          </div>

          {/* First admin */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold inline-flex items-center gap-2"><Mail className="size-4" /> First Org Admin invitation</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label>Full name</Label><Input placeholder="Jane Doe" /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" placeholder="admin@lakeside.health" /></div>
            </div>
            <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
              A signed, time-limited invitation token will be emailed. Expires in 72 hours.
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Provisioning summary</p>
            <dl className="mt-3 space-y-2 text-xs">
              <Row label="Tenant ID" value="org_lakeside" mono />
              <Row label="Region" value="ap-south-1" />
              <Row label="Tier" value="Basic" />
              <Row label="Multi-AZ" value="Yes" />
              <Row label="First admin" value="admin@…" />
            </dl>
            <ActionButton
              className="mt-4 w-full"
              confirm={{
                title: "Provision new tenant?",
                description: "Creates row-level tenant, dedicated S3 prefix + KMS key, seed roles, default policy v2.4, and sends Org Admin invitation.",
                confirmLabel: "Provision",
              }}
              href="/super/tenants"
              toastMessage="Tenant org_lakeside provisioned"
              toastDescription="Org Admin invitation sent · audit-logged"
            >
              Provision tenant <ArrowRight />
            </ActionButton>
            <Button asChild variant="outline" className="mt-2 w-full"><Link href="/super/tenants">Cancel</Link></Button>
          </div>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">What gets created</p>
            <ul className="mt-3 space-y-2 text-[var(--color-muted-foreground)]">
              <li className="flex gap-2"><CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" /> Isolated row-level tenant + PostgreSQL RLS</li>
              <li className="flex gap-2"><CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" /> Dedicated S3 prefix + KMS key</li>
              <li className="flex gap-2"><CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" /> Seed roles, default consent policy v2.4</li>
              <li className="flex gap-2"><CheckCircle2 className="size-3.5 shrink-0 text-[var(--color-success)]" /> Org Admin invitation token via SendGrid</li>
            </ul>
            <div className="mt-3"><Badge variant="muted" size="sm"><ShieldCheck className="size-3" /> Provisioning is audit-logged</Badge></div>
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
