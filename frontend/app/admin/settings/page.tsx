"use client";

import * as React from "react";
import { toast } from "sonner";
import { Building2, Palette, Database, Bell, Phone, KeyRound, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LogoUpload, EditColorButton } from "./org-widgets";
import { useAdminStore, type OrgProfile, type RetentionPolicy } from "@/lib/admin-store";

export default function AdminSettingsPage() {
  const { state, updateOrgProfile, updateRetention, updateChannels, markOnboardingStep } = useAdminStore();
  const [profile, setProfile] = React.useState<OrgProfile>(state.orgProfile);
  const [retention, setRetention] = React.useState<RetentionPolicy>(state.retention);

  React.useEffect(() => {
    if (state.hydrated) {
      setProfile(state.orgProfile);
      setRetention(state.retention);
    }
  }, [state.hydrated, state.orgProfile, state.retention]);

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  function saveProfile() {
    updateOrgProfile(profile);
    markOnboardingStep("orgProfileComplete", true);
    toast.success("Organization settings saved", { description: "audit-logged · org.update" });
  }
  function discardProfile() {
    setProfile(state.orgProfile);
    toast.info("Changes discarded");
  }

  function savePolicy() {
    updateRetention(retention);
    toast.success("Policy saved", { description: "audit-logged · org.policy" });
  }
  function discardPolicy() {
    setRetention(state.retention);
    toast.info("Changes discarded");
  }

  return (
    <>
      <PageHeader
        eyebrow="Organization"
        title="Organization settings"
        description="Profile, branding, retention, password policy, and channel configuration."
      />

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile"><Building2 /> Profile</TabsTrigger>
          <TabsTrigger value="branding"><Palette /> Branding</TabsTrigger>
          <TabsTrigger value="retention"><Database /> Retention</TabsTrigger>
          <TabsTrigger value="policy"><KeyRound /> Policy</TabsTrigger>
          <TabsTrigger value="channels"><Bell /> Channels</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Organization name</Label>
                <Input value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  value={profile.type}
                  onChange={(e) => setProfile((p) => ({ ...p, type: e.target.value as OrgProfile["type"] }))}
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
                >
                  <option>Hospital</option>
                  <option>Clinic</option>
                  <option>Telemedicine</option>
                  <option>Diagnostic</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Primary contact email</Label>
                <Input value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} leadingIcon={<Phone />} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Textarea value={profile.address} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={discardProfile}>Discard</Button>
              <Button onClick={saveProfile}>Save</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="branding">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h3 className="text-sm font-semibold">Logo</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">Shown in patient header and emails. SVG or PNG, max 1 MB.</p>
              <div className="mt-4 flex h-32 items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30">
                <LogoUpload />
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h3 className="text-sm font-semibold">Color tokens</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">Restricted to safe ranges. Contrast is auto-validated.</p>
              <div className="mt-4 space-y-3">
                <ColorRow
                  label="Primary"
                  value={profile.primaryColor}
                  onChange={(v) => {
                    setProfile((p) => ({ ...p, primaryColor: v }));
                    updateOrgProfile({ primaryColor: v });
                  }}
                />
                <ColorRow
                  label="Secondary"
                  value={profile.secondaryColor}
                  onChange={(v) => {
                    setProfile((p) => ({ ...p, secondaryColor: v }));
                    updateOrgProfile({ secondaryColor: v });
                  }}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="retention">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
            <h3 className="text-sm font-semibold">Retention defaults</h3>
            <p className="text-xs text-[var(--color-muted-foreground)]">Compliance Manager can override these per data type.</p>
            <div className="mt-3 space-y-3">
              <RetentionRow
                label="Medical records"
                unit="years"
                value={retention.medicalRecordsYears}
                onChange={(v) => setRetention((r) => ({ ...r, medicalRecordsYears: v }))}
              />
              <RetentionRow
                label="Documents"
                unit="years"
                value={retention.documentsYears}
                onChange={(v) => setRetention((r) => ({ ...r, documentsYears: v }))}
              />
              <RetentionRow
                label="Messages"
                unit="years"
                value={retention.messagesYears}
                onChange={(v) => setRetention((r) => ({ ...r, messagesYears: v }))}
              />
              <RetentionRow
                label="Notifications"
                unit="months"
                value={retention.notificationsMonths}
                onChange={(v) => setRetention((r) => ({ ...r, notificationsMonths: v }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={discardPolicy}>Discard</Button>
              <Button onClick={savePolicy}>Save changes</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="policy">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 space-y-4">
            <h3 className="text-sm font-semibold">Password & session</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Min password length</Label>
                <Input
                  type="number"
                  value={retention.passwordMinLength}
                  onChange={(e) => setRetention((r) => ({ ...r, passwordMinLength: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Password history (last N)</Label>
                <Input
                  type="number"
                  value={retention.passwordReuseHistory}
                  onChange={(e) => setRetention((r) => ({ ...r, passwordReuseHistory: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Patient session timeout (minutes)</Label>
                <Input
                  type="number"
                  value={retention.patientSessionMinutes}
                  onChange={(e) => setRetention((r) => ({ ...r, patientSessionMinutes: parseInt(e.target.value, 10) || 0 }))}
                />
                <p className="text-[10px] text-[var(--color-muted-foreground)]">
                  Note: actual session TTL is governed by the auth layer · changes here mark policy intent for ops review.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Clinical session timeout (minutes)</Label>
                <Input
                  type="number"
                  value={retention.clinicalStaffSessionMinutes}
                  onChange={(e) => setRetention((r) => ({ ...r, clinicalStaffSessionMinutes: parseInt(e.target.value, 10) || 0 }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={discardPolicy}>Discard</Button>
              <Button onClick={savePolicy}>Save changes</Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="channels">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChannelCard
              name="SendGrid (Email)"
              desc="Verified sender: ops@citygeneral.health"
              enabled={state.channels.emailEnabled}
              onToggle={(v) => {
                updateChannels({ emailEnabled: v });
                toast.success(`Email ${v ? "enabled" : "disabled"}`);
              }}
            />
            <ChannelCard
              name="Twilio (SMS)"
              desc="Sender ID: CITYGEN · 6 countries"
              enabled={state.channels.smsEnabled}
              onToggle={(v) => {
                updateChannels({ smsEnabled: v });
                toast.success(`SMS ${v ? "enabled" : "disabled"}`);
              }}
            />
            <ChannelCard
              name="In-app push"
              desc="Always enabled · web + mobile portal"
              enabled={state.channels.inAppEnabled}
              onToggle={(v) => {
                updateChannels({ inAppEnabled: v });
                toast.success(`In-app ${v ? "enabled" : "disabled"}`);
              }}
              alwaysOn
            />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="size-8 rounded-lg border border-[var(--color-border)]" style={{ background: value }} />
      <div className="flex-1">
        <p className="text-xs font-medium">{label}</p>
        <p className="font-mono text-[10px] text-[var(--color-muted-foreground)]">{value}</p>
      </div>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]"
        aria-label={`Edit ${label}`}
      />
      <EditColorButton label={label} value={value} />
    </div>
  );
}

function RetentionRow({ label, unit, value, onChange }: { label: string; unit: "years" | "months"; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] p-4">
      <div className="flex-1">
        <p className="text-sm font-medium inline-flex items-center gap-2">
          <HardDrive className="size-4 text-[var(--color-muted-foreground)]" /> {label}
        </p>
        <p className="text-[11px] text-[var(--color-muted-foreground)]">Retention: {value} {unit}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          className="w-20"
        />
        <span className="text-xs text-[var(--color-muted-foreground)]">{unit}</span>
      </div>
    </div>
  );
}

function ChannelCard({ name, desc, enabled, onToggle, alwaysOn }: { name: string; desc: string; enabled: boolean; onToggle: (v: boolean) => void; alwaysOn?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{name}</p>
        {enabled ? <Badge variant="success" size="sm" dot>Active</Badge> : <Badge variant="muted" size="sm">Disabled</Badge>}
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{desc}</p>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-[var(--color-muted-foreground)]">{alwaysOn ? "Recommended — keep on" : "Enabled"}</span>
        <Switch checked={enabled} onCheckedChange={onToggle} disabled={alwaysOn && enabled} />
      </div>
    </div>
  );
}
