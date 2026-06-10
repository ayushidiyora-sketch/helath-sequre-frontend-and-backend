"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Stethoscope, KeyRound, Bell, Monitor, ShieldCheck, Award, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";
import { NotificationPreferences } from "@/components/shared/notification-preferences";
import { validateName } from "@/lib/validate-name";
import { LoginOtpToggle } from "@/components/shared/login-otp-toggle";

/** DB-backed clinician profile (GET/PATCH /api/clinician/profile). */
interface ClinicianProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  organization: string;
  profilePhotoUrl: string | null;
}

const EMPTY_PROFILE: ClinicianProfile = {
  firstName: "", lastName: "", email: "", phone: "",
  department: "", designation: "", organization: "", profilePhotoUrl: null,
};

export default function ClinicianSettings() {
  const [profile, setProfile] = useState<ClinicianProfile>(EMPTY_PROFILE);
  const [draft, setDraft] = useState<ClinicianProfile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);

  // Load the real DB profile (was previously a localStorage demo store, which
  // showed stale "vodey sddddd" data unrelated to the signed-in clinician).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/api/clinician/profile", { cache: "no-store" });
        const j = await r.json();
        if (!alive || !r.ok || !j?.ok) return;
        setProfile(j.profile as ClinicianProfile);
        setDraft(j.profile as ClinicianProfile);
      } catch {
        /* keep empty form on error */
      }
    })();
    return () => { alive = false; };
  }, []);

  const update = <K extends keyof ClinicianProfile>(key: K, value: ClinicianProfile[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const firstNameError = validateName(draft.firstName, "First name");
  const lastNameError = validateName(draft.lastName, "Last name");

  async function handleSave() {
    if (firstNameError || lastNameError) {
      toast.error(firstNameError ?? lastNameError ?? "Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/clinician/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: draft.firstName,
          lastName: draft.lastName,
          phone: draft.phone,
          department: draft.department,
          designation: draft.designation,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j?.ok) {
        toast.error(j?.error ?? "Could not save profile");
        return;
      }
      setProfile(j.profile as ClinicianProfile);
      setDraft(j.profile as ClinicianProfile);
      toast.success("Profile saved", { description: "audit-logged · user.update" });
    } catch {
      toast.error("Network error — could not save");
    } finally {
      setSaving(false);
    }
  }
  function handleDiscard() {
    setDraft(profile);
    toast.info("Changes discarded");
  }

  return (
    <>
      <PageHeader eyebrow="Settings" title="Account & preferences" description="Profile, security, notifications, and active sessions." />

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile"><Stethoscope /> Profile</TabsTrigger>
          <TabsTrigger value="security"><KeyRound /> Security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell /> Notifications</TabsTrigger>
          <TabsTrigger value="sessions"><Monitor /> Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
            <div className="space-y-5">
              <Section title="Profile" desc="Visible to your patients and care team.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="first" label="First name" value={draft.firstName} onChange={(v) => update("firstName", v)} error={firstNameError} />
                  <Field id="last" label="Last name" value={draft.lastName} onChange={(v) => update("lastName", v)} error={lastNameError} />
                  <Field id="spec" label="Specialty / title" value={draft.designation} onChange={(v) => update("designation", v)} leadingIcon={<Award />} />
                  <Field id="dept" label="Department" value={draft.department} onChange={(v) => update("department", v)} />
                  <Field id="email" label="Email" value={draft.email} onChange={() => {}} readOnly />
                  <Field id="phone" label="Phone" value={draft.phone} onChange={(v) => update("phone", v)} />
                </div>
              </Section>
              <Section title="Practice" desc="Clinic affiliation.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="org" label="Organization" value={draft.organization || "—"} onChange={() => {}} leadingIcon={<Building2 />} readOnly />
                </div>
              </Section>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleDiscard} disabled={saving}>Discard</Button>
                <Button onClick={handleSave} disabled={saving || !!firstNameError || !!lastNameError}>Save changes</Button>
              </div>
            </div>
            <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
                <div className="flex items-center gap-3">
                  <Avatar className="size-14">
                    {profile.profilePhotoUrl && <AvatarImage src={profile.profilePhotoUrl} alt={`${profile.firstName} ${profile.lastName}`} />}
                    <AvatarFallback>
                      {((profile.firstName[0] ?? "") + (profile.lastName[0] ?? "")).toUpperCase() || "·"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">Dr. {profile.firstName} {profile.lastName}</p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">{profile.designation || profile.department}</p>
                  </div>
                </div>
                <ActionButton variant="outline" size="sm" className="mt-4 w-full" toastMessage="Photo upload opened" toastVariant="info">
                  Change photo
                </ActionButton>
              </div>
              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
                <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Compliance posture</p>
                <ul className="mt-3 space-y-1.5">
                  <li className="flex items-center gap-2 text-[var(--color-success)]">
                    <ShieldCheck className="size-3.5" /> MFA enrolled
                  </li>
                  <li className="flex items-center gap-2 text-[var(--color-success)]">
                    <ShieldCheck className="size-3.5" /> License current
                  </li>
                  <li className="flex items-center gap-2 text-[var(--color-success)]">
                    <ShieldCheck className="size-3.5" /> HIPAA training · Mar 2026
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="security">
          <div className="mb-5">
            <LoginOtpToggle />
          </div>
          <Section title="Mandatory MFA" desc="Required by Org Admin policy for all clinical roles.">
            <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/30 p-4 text-sm">
              TOTP active · Google Authenticator · last used 12 m ago
            </div>
            <div className="mt-3 flex gap-2">
              <ActionButton size="sm" variant="outline" toastMessage="Recovery codes shown" toastDescription="Save these — each is single-use">
                View recovery codes
              </ActionButton>
              <ActionButton
                size="sm"
                variant="outline"
                confirm={{
                  title: "Re-enroll MFA device?",
                  description: "Your current TOTP device will stop working. You'll need to scan a new QR code.",
                  confirmLabel: "Re-enroll",
                }}
                href="/mfa-setup"
                toastMessage="Re-enrollment started"
              >
                Re-enroll device
              </ActionButton>
            </div>
          </Section>
          <div className="mt-5">
            <SecurityBadge variant="audited" />
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationPreferences role="clinician" />
        </TabsContent>

        <TabsContent value="sessions">
          <Section title="Active sessions" desc="Sign out any device you don't recognize.">
            {[
              { d: "Chrome · macOS", ip: "10.0.0.42 · Hospital LAN", time: "Active", current: true },
              { d: "iOS · iPhone 15", ip: "172.16.4.21 · Hospital Wi-Fi", time: "1h ago" },
            ].map((s) => (
              <div key={s.d} className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                <Monitor className="size-5 text-[var(--color-muted-foreground)]" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{s.d}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">{s.ip} · {s.time}</p>
                </div>
                {s.current ? (
                  <span className="rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-success)]">This device</span>
                ) : (
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                    confirm={{
                      title: `Revoke session on ${s.d}?`,
                      description: "This device will be signed out immediately.",
                      confirmLabel: "Revoke",
                      variant: "destructive",
                    }}
                    toastMessage="Session revoked"
                    toastVariant="warning"
                  >
                    Revoke
                  </ActionButton>
                )}
              </div>
            ))}
          </Section>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">{desc}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  leadingIcon,
  readOnly,
  mono,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  leadingIcon?: React.ReactNode;
  readOnly?: boolean;
  mono?: boolean;
  error?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        leadingIcon={leadingIcon}
        readOnly={readOnly}
        aria-invalid={error ? true : undefined}
        className={`${mono ? "font-mono" : ""} ${readOnly ? "bg-[var(--color-muted)]" : ""} ${
          error ? "border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[var(--color-danger)]/15" : ""
        }`}
      />
      {error ? <p className="text-xs text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
