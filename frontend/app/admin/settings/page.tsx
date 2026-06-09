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
import { LoginOtpToggle } from "@/components/shared/login-otp-toggle";
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

interface PolicyState {
  minPasswordLength: number;
  passwordHistory: number;
  patientSessionMinutes: number;
  clinicalSessionMinutes: number;
}

const DEFAULT_POLICY: PolicyState = {
  minPasswordLength: 12,
  passwordHistory: 5,
  patientSessionMinutes: 30,
  clinicalSessionMinutes: 15,
};

interface ChannelsState {
  email: { enabled: boolean; verifiedSender: string };
  sms: { enabled: boolean; senderId: string; countries: number };
  inApp: { enabled: boolean };
}

const DEFAULT_CHANNELS: ChannelsState = {
  email: { enabled: true, verifiedSender: "" },
  sms: { enabled: true, senderId: "", countries: 0 },
  inApp: { enabled: true },
};

export default function AdminSettingsPage() {
  // `updateChannels` was previously used here when channel toggles wrote to
  // localStorage; channels are now DB-backed via /api/admin/channels, so we
  // drop that destructure but keep the rest of the store wiring (profile +
  // retention + onboarding still flow through it).
  const { state, updateOrgProfile, updateRetention, markOnboardingStep } = useAdminStore();
  const { applyBranding } = useBranding();
  const [profile, setProfile] = React.useState<OrgProfile>(state.orgProfile);
  const [retention, setRetention] = React.useState<RetentionPolicy>(state.retention);
  const [policy, setPolicy] = React.useState<PolicyState>(DEFAULT_POLICY);
  const [policyServer, setPolicyServer] = React.useState<PolicyState>(DEFAULT_POLICY);
  const [policyLoading, setPolicyLoading] = React.useState(true);
  const [policySaving, setPolicySaving] = React.useState(false);
  const [channels, setChannels] = React.useState<ChannelsState>(DEFAULT_CHANNELS);
  const [channelsLoading, setChannelsLoading] = React.useState(true);
  // Per-channel saving flags so flipping the email toggle doesn't grey out
  // the SMS row (and so verified-sender input doesn't block channel toggles).
  const [channelSaving, setChannelSaving] = React.useState<{
    email: boolean;
    sms: boolean;
    inApp: boolean;
  }>({ email: false, sms: false, inApp: false });

  // Load channel configuration from the DB on mount.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/channels", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok || !data.channels) return;
        setChannels(data.channels as ChannelsState);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setChannelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Send a partial channel update to the API. Used for both toggle flips and
   * sender-field saves. On success we replace the full state with the server
   * response so any clamps (e.g. inApp.enabled forced true) are reflected
   * immediately.
   */
  const saveChannelPatch = React.useCallback(
    async (
      patch: Partial<ChannelsState>,
      which: "email" | "sms" | "inApp",
      successMsg?: string,
    ) => {
      setChannelSaving((s) => ({ ...s, [which]: true }));
      try {
        const r = await fetch("/api/admin/channels", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await r.json()) as { ok: boolean; error?: string; channels?: ChannelsState };
        if (!r.ok || !data.ok || !data.channels) {
          toast.error("Could not save channel", { description: data.error ?? `HTTP ${r.status}` });
          return false;
        }
        setChannels(data.channels);
        if (successMsg) toast.success(successMsg);
        return true;
      } catch (e) {
        toast.error("Network error", { description: e instanceof Error ? e.message : "" });
        return false;
      } finally {
        setChannelSaving((s) => ({ ...s, [which]: false }));
      }
    },
    [],
  );
  const [apiTenant, setApiTenant] = React.useState<ApiTenant | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [profileSaving, setProfileSaving] = React.useState(false);

  // Hydrate the Policy tab from /api/admin/policy. The Retention tab still
  // owns medical/document/message/notification retention; policy here is
  // password + session timeouts only.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/policy", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok || !data.policy) return;
        const next: PolicyState = {
          minPasswordLength: data.policy.minPasswordLength,
          passwordHistory: data.policy.passwordHistory,
          patientSessionMinutes: data.policy.patientSessionMinutes,
          clinicalSessionMinutes: data.policy.clinicalSessionMinutes,
        };
        setPolicy(next);
        setPolicyServer(next);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPolicyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function savePolicy() {
    if (policySaving) return;
    setPolicySaving(true);
    try {
      const r = await fetch("/api/admin/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const data = (await r.json()) as { ok: boolean; error?: string; policy?: PolicyState };
      if (!r.ok || !data.ok || !data.policy) {
        toast.error(data.error ?? "Could not save policy.");
        return;
      }
      // Reflect the server-clamped values (e.g. 1000 → 720) back into the form.
      const saved: PolicyState = {
        minPasswordLength: data.policy.minPasswordLength,
        passwordHistory: data.policy.passwordHistory,
        patientSessionMinutes: data.policy.patientSessionMinutes,
        clinicalSessionMinutes: data.policy.clinicalSessionMinutes,
      };
      setPolicy(saved);
      setPolicyServer(saved);
      // Mirror the timeout values onto the legacy local store so any older
      // page still reading from useAdminStore sees the latest figures.
      updateRetention({
        ...retention,
        passwordMinLength: saved.minPasswordLength,
        passwordReuseHistory: saved.passwordHistory,
        patientSessionMinutes: saved.patientSessionMinutes,
        clinicalStaffSessionMinutes: saved.clinicalSessionMinutes,
      });
      toast.success("Policy saved", {
        description: `Patient ${saved.patientSessionMinutes}m · clinical ${saved.clinicalSessionMinutes}m · audit-logged`,
      });
    } catch (e) {
      toast.error("Could not save policy.", {
        description: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      setPolicySaving(false);
    }
  }
  function discardPolicy() {
    setPolicy(policyServer);
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
          <div className="mt-5">
            <LoginOtpToggle />
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
            {policyLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-muted-foreground)]">
                <Loader2 className="size-4 animate-spin" /> Loading policy…
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Min password length</Label>
                    <Input
                      type="number"
                      min={8}
                      max={128}
                      value={policy.minPasswordLength}
                      onChange={(e) =>
                        setPolicy((p) => ({ ...p, minPasswordLength: parseInt(e.target.value, 10) || 0 }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Password history (last N)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={policy.passwordHistory}
                      onChange={(e) =>
                        setPolicy((p) => ({ ...p, passwordHistory: parseInt(e.target.value, 10) || 0 }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Patient session timeout (minutes)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={policy.patientSessionMinutes}
                      onChange={(e) =>
                        setPolicy((p) => ({ ...p, patientSessionMinutes: parseInt(e.target.value, 10) || 0 }))
                      }
                    />
                    <p className="text-[10px] text-[var(--color-muted-foreground)]">
                      Patient portal idles out after this many minutes of no activity, then auto sign-out.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Clinical session timeout (minutes)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={720}
                      value={policy.clinicalSessionMinutes}
                      onChange={(e) =>
                        setPolicy((p) => ({ ...p, clinicalSessionMinutes: parseInt(e.target.value, 10) || 0 }))
                      }
                    />
                    <p className="text-[10px] text-[var(--color-muted-foreground)]">
                      Clinician, admin, auditor and compliance surfaces idle out after this many minutes.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={discardPolicy} disabled={policySaving}>
                    Discard
                  </Button>
                  <Button onClick={savePolicy} disabled={policySaving}>
                    {policySaving ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" /> Saving…
                      </>
                    ) : (
                      "Save changes"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="channels">
          {channelsLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-muted-foreground)]">
              <Loader2 className="size-4 animate-spin" /> Loading channels…
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChannelCard
                name="SendGrid (Email)"
                enabled={channels.email.enabled}
                saving={channelSaving.email}
                onToggle={(v) =>
                  saveChannelPatch(
                    { email: { ...channels.email, enabled: v } },
                    "email",
                    `Email ${v ? "enabled" : "disabled"}`,
                  )
                }
                fields={[
                  {
                    key: "verifiedSender",
                    label: "Verified sender",
                    value: channels.email.verifiedSender,
                    placeholder: "ops@example.health",
                    onSave: (next) =>
                      saveChannelPatch(
                        { email: { ...channels.email, verifiedSender: next } },
                        "email",
                        "Verified sender saved",
                      ),
                  },
                ]}
              />
              <ChannelCard
                name="Twilio (SMS)"
                enabled={channels.sms.enabled}
                saving={channelSaving.sms}
                onToggle={(v) =>
                  saveChannelPatch(
                    { sms: { ...channels.sms, enabled: v } },
                    "sms",
                    `SMS ${v ? "enabled" : "disabled"}`,
                  )
                }
                fields={[
                  {
                    key: "senderId",
                    label: "Sender ID",
                    value: channels.sms.senderId,
                    placeholder: "e.g. CITYGEN",
                    onSave: (next) =>
                      saveChannelPatch(
                        { sms: { ...channels.sms, senderId: next } },
                        "sms",
                        "Sender ID saved",
                      ),
                  },
                  {
                    key: "countries",
                    label: "Countries enabled",
                    value: String(channels.sms.countries),
                    type: "number",
                    placeholder: "e.g. 6",
                    onSave: (next) =>
                      saveChannelPatch(
                        {
                          sms: {
                            ...channels.sms,
                            countries: parseInt(next, 10) || 0,
                          },
                        },
                        "sms",
                        "Country count saved",
                      ),
                  },
                ]}
              />
              <ChannelCard
                name="In-app push"
                enabled={channels.inApp.enabled}
                saving={channelSaving.inApp}
                onToggle={() => undefined}
                fields={[]}
                alwaysOn
                desc="Web + mobile portal. Always enabled per platform policy."
              />
            </div>
          )}
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

interface ChannelField {
  key: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "number" | "email";
  /** Called when the user blurs / presses Enter. Returns the API success flag. */
  onSave: (next: string) => Promise<boolean>;
}

function ChannelCard({
  name,
  enabled,
  onToggle,
  alwaysOn,
  desc,
  fields,
  saving,
}: {
  name: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  alwaysOn?: boolean;
  desc?: string;
  fields: ChannelField[];
  saving: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{name}</p>
        {enabled ? (
          <Badge variant="success" size="sm" dot>
            Active
          </Badge>
        ) : (
          <Badge variant="muted" size="sm">
            Disabled
          </Badge>
        )}
      </div>
      {desc && <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{desc}</p>}
      {fields.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {fields.map((f) => (
            <ChannelFieldRow key={f.key} field={f} disabled={saving} />
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
        <span className="text-xs text-[var(--color-muted-foreground)]">
          {alwaysOn ? "Recommended — keep on" : enabled ? "Enabled" : "Disabled"}
        </span>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="size-3.5 animate-spin text-[var(--color-muted-foreground)]" />}
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={alwaysOn || saving}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Inline-edit field on a channel card. Edits buffer in local state; saving
 * happens on blur or Enter. Escape cancels and reverts.
 */
function ChannelFieldRow({ field, disabled }: { field: ChannelField; disabled: boolean }) {
  const [value, setValue] = React.useState(field.value);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Sync local buffer when the parent's value changes (e.g. after a remote
  // save replaces channels state).
  React.useEffect(() => {
    setValue(field.value);
    setDirty(false);
  }, [field.value]);

  async function commit() {
    if (!dirty || saving) return;
    setSaving(true);
    const ok = await field.onSave(value);
    setSaving(false);
    if (ok) setDirty(false);
  }

  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
        {field.label}
      </Label>
      <Input
        type={field.type ?? "text"}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(e.target.value !== field.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          } else if (e.key === "Escape") {
            setValue(field.value);
            setDirty(false);
            (e.target as HTMLInputElement).blur();
          }
        }}
        disabled={disabled || saving}
        className="h-9 text-sm"
      />
    </div>
  );
}
