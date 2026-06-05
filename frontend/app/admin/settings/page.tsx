"use client";

import * as React from "react";
import { toast } from "sonner";
import { Building2, Palette, Database, Bell, Phone, KeyRound, HardDrive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EditColorButton } from "./org-widgets";
import { Upload } from "lucide-react";
import { useBranding } from "@/components/shared/branding-theme";
import { NotificationPreferences } from "@/components/shared/notification-preferences";
import { useAdminStore, type OrgProfile, type RetentionPolicy } from "@/lib/admin-store";

interface ApiBranding {
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

interface ApiTenant {
  id: string;
  name: string;
  type: string;
  contact?: { email?: string; phone?: string; address?: string };
  branding?: ApiBranding;
}

export default function AdminSettingsPage() {
  const { state, updateOrgProfile, updateRetention, updateChannels, markOnboardingStep } = useAdminStore();
  const { applyBranding } = useBranding();
  const [profile, setProfile] = React.useState<OrgProfile>(state.orgProfile);
  const [retention, setRetention] = React.useState<RetentionPolicy>(state.retention);
  const [apiTenant, setApiTenant] = React.useState<ApiTenant | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [profileSaving, setProfileSaving] = React.useState(false);

  // Hydrate once when the local store finishes loading. After that, profile is
  // owned by this page (API GET + PATCH) and retention is owned by the
  // Retention tab — re-syncing them on every state.orgProfile change races
  // with the Save handler and can briefly drop an input's value to undefined.
  const hydratedOnce = React.useRef(false);
  React.useEffect(() => {
    if (state.hydrated && !hydratedOnce.current) {
      hydratedOnce.current = true;
      setProfile(state.orgProfile);
      setRetention(state.retention);
    }
  }, [state.hydrated, state.orgProfile, state.retention]);

  // Hydrate profile fields from the real tenant row + settings.contact JSON.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/tenant", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        const t = data.tenant as ApiTenant;
        setApiTenant(t);
        setProfile((prev) => ({
          ...prev,
          name: t.name,
          type: t.type as OrgProfile["type"],
          email: t.contact?.email ?? "",
          phone: t.contact?.phone ?? "",
          address: t.contact?.address ?? "",
          primaryColor: t.branding?.primaryColor || prev.primaryColor,
          secondaryColor: t.branding?.secondaryColor || prev.secondaryColor,
        }));
        if (t.branding?.logoUrl) setLogoUrl(t.branding.logoUrl);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Branding state lives at the page level so the Logo + Color rows can share
  // the same PATCH helper.
  const [logoUrl, setLogoUrl] = React.useState<string>("");
  const [brandingSaving, setBrandingSaving] = React.useState(false);

  async function saveBranding(patch: ApiBranding) {
    setBrandingSaving(true);
    try {
      const r = await fetch("/api/admin/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding: patch }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast.error(data.error ?? "Could not save branding.");
        return false;
      }
      const t = (data.tenant ?? {}) as ApiTenant;
      setApiTenant((prev) => ({ ...(prev ?? { id: "", name: "", type: "" }), ...t }));
      if (typeof t.branding?.logoUrl === "string") setLogoUrl(t.branding.logoUrl);
      if (t.branding?.primaryColor || t.branding?.secondaryColor) {
        setProfile((prev) => ({
          ...prev,
          primaryColor: t.branding?.primaryColor || prev.primaryColor,
          secondaryColor: t.branding?.secondaryColor || prev.secondaryColor,
        }));
        updateOrgProfile({
          primaryColor: t.branding?.primaryColor || profile.primaryColor,
          secondaryColor: t.branding?.secondaryColor || profile.secondaryColor,
        });
      }
      return true;
    } finally {
      setBrandingSaving(false);
    }
  }

  async function handleLogoFile(file: File) {
    if (file.size > 1_000_000) {
      toast.error("Logo is too large (max 1 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result ?? "");
      applyBranding({ logoUrl: dataUrl });
      const ok = await saveBranding({ logoUrl: dataUrl });
      if (ok) toast.success("Logo uploaded", { description: `${file.name} · applied to patient header & emails` });
    };
    reader.onerror = () => toast.error("Could not read the file.");
    reader.readAsDataURL(file);
  }

  async function handleLogoClear() {
    applyBranding({ logoUrl: "" });
    const ok = await saveBranding({ logoUrl: "" });
    if (ok) toast.success("Logo removed");
  }

  // Debounce color saves so dragging the native color picker doesn't fire a
  // PATCH on every pixel — wait 350ms after the last change before persisting.
  const colorSaveTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  function handleColorChange(field: "primaryColor" | "secondaryColor", value: string) {
    // Optimistic local update for instant preview — both the form and the
    // global theme provider re-apply CSS variables across the whole portal.
    setProfile((prev) => ({ ...prev, [field]: value }));
    applyBranding({ [field]: value });
    clearTimeout(colorSaveTimers.current[field]);
    colorSaveTimers.current[field] = setTimeout(async () => {
      const ok = await saveBranding({ [field]: value });
      if (ok) toast.success(`${field === "primaryColor" ? "Primary" : "Secondary"} color updated`, { description: value });
    }, 350);
  }

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  async function saveProfile() {
    setProfileSaving(true);
    try {
      const r = await fetch("/api/admin/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          // type + contact.email are read-only in the UI; only persist phone/address overrides.
          contact: { phone: profile.phone, address: profile.address },
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast.error(data.error ?? "Could not save organization settings.");
        return;
      }
      // Build the post-save snapshot. If the response is missing a field
      // (stale dev compile, transient hiccup), fall back to what's already on
      // screen so the form doesn't suddenly clear.
      const t = (data.tenant ?? {}) as ApiTenant;
      const merged = {
        name: t.name || profile.name,
        type: ((t.type as OrgProfile["type"]) || profile.type) as OrgProfile["type"],
        email: t.contact?.email || profile.email,
        phone: t.contact?.phone ?? profile.phone,
        address: t.contact?.address ?? profile.address,
      };
      setApiTenant({
        id: t.id ?? "",
        name: merged.name,
        type: merged.type,
        contact: { email: merged.email, phone: merged.phone, address: merged.address },
      });
      setProfile((prev) => ({ ...prev, ...merged }));
      // Mirror to local admin-store so dashboard widgets stay consistent.
      updateOrgProfile(merged);
      markOnboardingStep("orgProfileComplete", true);
      toast.success("Organization settings saved", { description: "audit-logged · org.update" });
    } finally {
      setProfileSaving(false);
    }
  }
  function discardProfile() {
    if (apiTenant) {
      setProfile((prev) => ({
        ...prev,
        name: apiTenant.name,
        type: apiTenant.type as OrgProfile["type"],
        email: apiTenant.contact?.email ?? "",
        phone: apiTenant.contact?.phone ?? "",
        address: apiTenant.contact?.address ?? "",
      }));
    } else {
      setProfile(state.orgProfile);
    }
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
            {profileLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-muted-foreground)]">
                <Loader2 className="size-4 animate-spin" /> Loading organization…
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Organization name</Label>
                    <Input value={profile.name ?? ""} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Input value={profile.type ?? ""} readOnly aria-readonly className="cursor-not-allowed bg-[var(--color-muted)]/40" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Primary contact email</Label>
                    <Input value={profile.email ?? ""} readOnly aria-readonly className="cursor-not-allowed bg-[var(--color-muted)]/40" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={profile.phone ?? ""} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} leadingIcon={<Phone />} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Address</Label>
                    <Textarea value={profile.address ?? ""} onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={discardProfile} disabled={profileSaving}>Discard</Button>
                  <Button onClick={saveProfile} disabled={profileSaving}>
                    {profileSaving ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Saving…
                      </>
                    ) : (
                      "Save"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="branding">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h3 className="text-sm font-semibold">Logo</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">Shown in patient header and emails. SVG, PNG or JPEG, max 1 MB.</p>
              <div className="mt-4 flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/30">
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logoUrl} alt="Organization logo" className="max-h-32 max-w-full object-contain" />
                ) : (
                  <p className="text-xs text-[var(--color-muted-foreground)]">No logo uploaded yet</p>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <LogoUploadButton onFile={handleLogoFile} disabled={brandingSaving} />
                {logoUrl && (
                  <Button variant="outline" size="sm" onClick={handleLogoClear} disabled={brandingSaving}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
              <h3 className="text-sm font-semibold">Color tokens</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">Restricted to safe ranges. Contrast is auto-validated.</p>
              <div className="mt-4 space-y-3">
                <ColorRow
                  label="Primary"
                  value={profile.primaryColor ?? "#0E7490"}
                  onChange={(v) => handleColorChange("primaryColor", v)}
                />
                <ColorRow
                  label="Secondary"
                  value={profile.secondaryColor ?? "#FFFFFF"}
                  onChange={(v) => handleColorChange("secondaryColor", v)}
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
          <p className="mt-6 mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Your personal preferences
          </p>
          <NotificationPreferences role="admin" />
        </TabsContent>
      </Tabs>
    </>
  );
}

function LogoUploadButton({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/svg+xml,image/png,image/jpeg"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={disabled}>
        <Upload /> Upload logo
      </Button>
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
    </div>
  );
}
void EditColorButton;

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
