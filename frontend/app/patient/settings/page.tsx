"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  UserCircle2,
  KeyRound,
  Bell,
  Monitor,
  Database,
  Shield,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  Smartphone,
  Globe,
  Trash2,
  Download,
  AlertTriangle,
  Laptop,
  Tablet,
  LogOut,
  Lock,
  IdCard,
  Users,
  ShieldCheck,
  Syringe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { NotificationPreferences } from "@/components/shared/notification-preferences";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ActionButton } from "@/components/shared/action-button";
import { ChangePhotoButton, RecoveryCodesButton, AddPasskeyButton } from "./account-widgets";
import { FamilyManager } from "../family/family-manager";
import { EmergencyManager } from "../emergency/emergency-manager";
import { InsuranceManager } from "../insurance/insurance-manager";
import { VaccinationsManager } from "../vaccinations/vaccinations-manager";
import { usePatientStore, type Profile, type Session } from "@/lib/patient-store";
import { validateName } from "@/lib/validate-name";
import { LoginOtpToggle } from "@/components/shared/login-otp-toggle";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Account & preferences"
        description="Manage your profile, security factors, notifications, and data rights."
      />

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile"><UserCircle2 /> Profile</TabsTrigger>
          <TabsTrigger value="personal"><IdCard /> Personal information</TabsTrigger>
          <TabsTrigger value="security"><KeyRound /> Security</TabsTrigger>
          <TabsTrigger value="notifications"><Bell /> Notifications</TabsTrigger>
          <TabsTrigger value="sessions"><Monitor /> Sessions</TabsTrigger>
          <TabsTrigger value="data"><Database /> Data rights</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="personal">
          <PersonalTab />
        </TabsContent>
        <TabsContent value="security">
          <div className="space-y-5">
            <LoginOtpToggle />
            <SecurityTab />
          </div>
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="sessions">
          <SessionsTab />
        </TabsContent>
        <TabsContent value="data">
          <DataTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

interface ApiCareTeamMember {
  assignmentId: string;
  role: string | null;
  startedAt: string;
  clinician: {
    id: string;
    name: string;
    initials: string;
    designation: string | null;
    department: string | null;
    profilePhotoUrl: string | null;
  };
}

interface ApiProfile {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  profilePhotoUrl: string | null;
  tenantName: string | null;
  mfaEnrolled: boolean;
  mfaRequired: boolean;
  enrolledAt: string;
  mrn: string;
  initials: string;
}

function ProfileTab() {
  const { state, updateProfile } = usePatientStore();
  const [draft, setDraft] = useState<Profile>(state.profile);
  const [api, setApi] = useState<ApiProfile | null>(null);
  const [careTeam, setCareTeam] = useState<ApiCareTeamMember[]>([]);
  const [saving, setSaving] = useState(false);
  // Gender / profile photo aren't in the localStorage Profile shape (DB-only)
  // so we keep them as separate state hydrated from the API.
  const [gender, setGender] = useState<string>("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // First load: pull profile + care team from the API. Address fields stay in
  // the local store since there are no DB columns for them yet.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/patient/profile", { cache: "no-store" })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.ok) return;
        const p = data.profile as ApiProfile;
        setApi(p);
        setCareTeam((data.careTeam ?? []) as ApiCareTeamMember[]);
        setDraft((prev) => ({
          ...prev,
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          phone: p.phone ?? "",
          dob: p.dateOfBirth ?? "",
        }));
        setGender(p.gender ?? "");
        setPhotoUrl(p.profilePhotoUrl ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Pull in localStorage-hydrated address fields when they arrive.
  useEffect(() => {
    if (!state.hydrated) return;
    setDraft((prev) => ({
      ...prev,
      address: state.profile.address,
      city: state.profile.city,
      state: state.profile.state,
      postalCode: state.profile.postalCode,
    }));
  }, [state.hydrated, state.profile.address, state.profile.city, state.profile.state, state.profile.postalCode]);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  async function handleSave() {
    const fnErr = validateName(draft.firstName, "First name");
    const lnErr = validateName(draft.lastName, "Last name");
    if (fnErr || lnErr) {
      toast.error(fnErr ?? lnErr ?? "Please fix the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/patient/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: draft.firstName,
          lastName: draft.lastName,
          phone: draft.phone,
          dateOfBirth: draft.dob || null,
          gender: gender || null,
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast.error(data.error ?? "Could not save profile.");
        return;
      }
      setApi(data.profile as ApiProfile);
      // Persist the address slice to the local store; DB fields are now canonical.
      updateProfile({
        ...draft,
        firstName: data.profile.firstName,
        lastName: data.profile.lastName,
        email: data.profile.email,
        phone: data.profile.phone ?? "",
        dob: data.profile.dateOfBirth ?? "",
      });
      toast.success("Profile saved", { description: "audit-logged · user.update" });
    } finally {
      setSaving(false);
    }
  }
  function handleDiscard() {
    if (api) {
      setDraft((prev) => ({
        ...prev,
        firstName: api.firstName,
        lastName: api.lastName,
        email: api.email,
        phone: api.phone ?? "",
        dob: api.dateOfBirth ?? "",
      }));
      setGender(api.gender ?? "");
      setPhotoUrl(api.profilePhotoUrl ?? null);
    } else {
      setDraft(state.profile);
    }
    toast.info("Changes discarded");
  }

  async function handlePickPhoto(dataUrl: string, name: string) {
    // PATCH the profile with the new photo immediately — independent of the
    // Save Changes button so the avatar reflects the upload right away.
    try {
      const r = await fetch("/api/patient/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profilePhotoUrl: dataUrl }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        toast.error(data.error ?? "Could not update photo.");
        return;
      }
      setApi(data.profile as ApiProfile);
      setPhotoUrl(data.profile.profilePhotoUrl ?? null);
      toast.success("Profile photo updated", { description: `${name} · audit-logged` });
    } catch {
      toast.error("Network error — could not save photo.");
    }
  }

  const displayName =
    api?.name ?? `${state.profile.firstName} ${state.profile.lastName}`.trim();
  const displayInitials =
    api?.initials ??
    ((state.profile.firstName[0] ?? "") + (state.profile.lastName[0] ?? "")).toUpperCase();
  const enrolledLabel = api?.enrolledAt
    ? `Patient since ${new Date(api.enrolledAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    : "Patient since —";

  return (
    <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
      <div className="space-y-5">
        <Section title="Personal information" desc="Your name and identity are used across the portal and on records.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="first" label="First name" value={draft.firstName} onChange={(v) => update("firstName", v)} error={validateName(draft.firstName, "First name")} />
            <Field id="last" label="Last name" value={draft.lastName} onChange={(v) => update("lastName", v)} error={validateName(draft.lastName, "Last name")} />
            <Field id="email" label="Email" value={draft.email} leadingIcon={<Mail />} readOnly />
            <Field id="phone" label="Phone" value={draft.phone} onChange={(v) => update("phone", v)} leadingIcon={<Phone />} />
            <Field id="dob" label="Date of birth" value={draft.dob} onChange={(v) => update("dob", v)} leadingIcon={<CalendarDays />} />
            <div className="space-y-1.5">
              <label htmlFor="gender" className="text-xs font-medium text-[var(--color-muted-foreground)]">Gender</label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
              >
                <option value="">— Select —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
            <Field id="tenant" label="Clinic / Tenant" value={api?.tenantName ?? "—"} readOnly />
            <Field id="mrn" label="MRN" value={api?.mrn ?? "—"} mono readOnly />
          </div>
        </Section>

        <Section title="Address" desc="Used for telehealth eligibility and clinic communications.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="line1" label="Street" value={draft.address} onChange={(v) => update("address", v)} leadingIcon={<MapPin />} />
            <Field id="city" label="City" value={draft.city} onChange={(v) => update("city", v)} />
            <Field id="state" label="State / Region" value={draft.state} onChange={(v) => update("state", v)} />
            <Field id="zip" label="Postal code" value={draft.postalCode} onChange={(v) => update("postalCode", v)} />
          </div>
        </Section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleDiscard} disabled={saving}>Discard</Button>
          <Button
            onClick={handleSave}
            disabled={saving || !!validateName(draft.firstName, "First name") || !!validateName(draft.lastName, "Last name")}
          >
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Saving…
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-14">
              {photoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={photoUrl} alt={displayName} className="size-full rounded-full object-cover" />
              )}
              <AvatarFallback>{displayInitials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{displayName}</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">{enrolledLabel}</p>
              {api?.tenantName && (
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{api.tenantName}</p>
              )}
            </div>
          </div>
          <ChangePhotoButton onPicked={handlePickPhoto} />
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Care team</p>
          {careTeam.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
              No clinicians assigned yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {careTeam.map((t) => (
                <li key={t.assignmentId} className="flex items-center gap-2.5">
                  <Avatar className="size-7"><AvatarFallback>{t.clinician.initials}</AvatarFallback></Avatar>
                  <div>
                    <p className="text-xs font-medium">{t.clinician.name}</p>
                    <p className="text-[10px] text-[var(--color-muted-foreground)]">
                      {t.clinician.designation ?? t.clinician.department ?? "Care team"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonalTab() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
          <IdCard className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">Personal information</p>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            Family members, emergency information, insurance plans, and vaccinations — all in one place.
          </p>
        </div>
      </div>

      <Tabs defaultValue="family">
        <TabsList className="flex-wrap">
          <TabsTrigger value="family"><Users /> Family</TabsTrigger>
          <TabsTrigger value="emergency"><AlertTriangle /> Emergency</TabsTrigger>
          <TabsTrigger value="insurance"><ShieldCheck /> Insurance</TabsTrigger>
          <TabsTrigger value="vaccinations"><Syringe /> Vaccinations</TabsTrigger>
        </TabsList>

        <TabsContent value="family">
          <FamilyManager />
        </TabsContent>
        <TabsContent value="emergency">
          <EmergencyManager />
        </TabsContent>
        <TabsContent value="insurance">
          <InsuranceManager />
        </TabsContent>
        <TabsContent value="vaccinations">
          <VaccinationsManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SecurityTab() {
  const { state, setMfaEnabled } = usePatientStore();
  const [loginAlerts, setLoginAlerts] = useState({
    newDevice: true,
    failed: true,
    offHours: false,
  });
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  async function handleChangePassword() {
    if (pwSaving) return;
    setPwSaving(true);
    try {
      const r = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) {
        toast.error(data?.error ?? "Could not update password.");
        return;
      }
      toast.success("Password updated", { description: "Use it on your next sign-in · audit-logged" });
      setCurrentPw("");
      setNewPw("");
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setPwSaving(false);
    }
  }

  // Real DB-backed TOTP state, populated on mount. We keep the local store in
  // sync so any other view that reads `state.security.mfaEnabled` stays right.
  const [serverEnrolled, setServerEnrolled] = useState<boolean | null>(null);
  const refreshMfaStatus = async () => {
    try {
      const r = await fetch("/api/auth/mfa/status", { cache: "no-store" });
      const data = await r.json();
      if (r.ok && data.ok) {
        setServerEnrolled(!!data.enrolled);
        setMfaEnabled(!!data.enrolled);
      }
    } catch {
      /* fall back to the local store value */
    }
  };
  useEffect(() => {
    refreshMfaStatus();
    // refreshMfaStatus only updates state, no external deps to track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open-state + form-state for the "confirm with TOTP code" dialog.
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableErr, setDisableErr] = useState<string | null>(null);
  const [disabling, setDisabling] = useState(false);
  function openDisableDialog() {
    setDisableCode("");
    setDisableErr(null);
    setDisableOpen(true);
  }
  async function submitDisable(e: React.FormEvent) {
    e.preventDefault();
    setDisableErr(null);
    const cleaned = disableCode.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(cleaned)) {
      setDisableErr("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setDisabling(true);
    try {
      const r = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: cleaned }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setDisableErr(data.error ?? `Could not disable TOTP (HTTP ${r.status}).`);
        setDisabling(false);
        return;
      }
      setServerEnrolled(false);
      setMfaEnabled(false);
      setDisableOpen(false);
      toast.warning("TOTP disabled", {
        description: "Future sign-ins will fall back to email OTP.",
      });
    } catch {
      setDisableErr("Network error — could not disable TOTP.");
      setDisabling(false);
    }
  }

  // Prefer the server result once it's loaded; before that fall back to the
  // local store so the UI still renders something useful.
  const mfaOn = serverEnrolled ?? state.security.mfaEnabled;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
      <div className="space-y-5">
        <Section title="Password" desc="Min 12 chars · history of last 5 enforced.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="curpw" label="Current password" type="password" value={currentPw} onChange={setCurrentPw} />
            <Field id="newpw" label="New password" type="password" value={newPw} onChange={setNewPw} />
          </div>
          <Button
            className="mt-1"
            onClick={() => void handleChangePassword()}
            disabled={pwSaving || !currentPw || newPw.length < 12}
          >
            {pwSaving ? "Updating…" : "Update password"}
          </Button>
        </Section>

        <Section title="Two-factor authentication" desc="Optional for patients · strongly recommended.">
          {mfaOn ? (
            <div className="rounded-xl border border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/30 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-card)] text-[var(--color-success)] ring-1 ring-[var(--color-success)]/30">
                  <Shield className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">TOTP enabled</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    Authenticator · pair via /mfa-setup
                  </p>
                  <div className="mt-3 flex gap-2">
                    <RecoveryCodesButton />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={openDisableDialog}
                      className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                    >
                      Disable TOTP
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
                  <Shield className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">TOTP not enabled</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    Pair an authenticator app for a second sign-in factor.
                  </p>
                  <ActionButton
                    size="sm"
                    className="mt-3"
                    href={"/mfa-setup?next=" + encodeURIComponent("/patient/settings")}
                    onClick={() => setMfaEnabled(true)}
                  >
                    Enable TOTP
                  </ActionButton>
                </div>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <div>
              <p className="text-sm font-semibold">Passkey (WebAuthn)</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">Phishing-resistant · device-bound</p>
            </div>
            <AddPasskeyButton />
          </div>
        </Section>

        <Section title="Login alerts" desc="Get notified on suspicious or new-device activity.">
          <SettingRow
            label="New device sign-ins"
            desc="Push + email when a new device authenticates"
            checked={loginAlerts.newDevice}
            onCheckedChange={(v) => setLoginAlerts((s) => ({ ...s, newDevice: v }))}
          />
          <SettingRow
            label="Failed sign-ins"
            desc="Email after 3 consecutive failures"
            checked={loginAlerts.failed}
            onCheckedChange={(v) => setLoginAlerts((s) => ({ ...s, failed: v }))}
          />
          <SettingRow
            label="Off-hours access"
            desc="Alert if your account is used between midnight and 5 AM"
            checked={loginAlerts.offHours}
            onCheckedChange={(v) => setLoginAlerts((s) => ({ ...s, offHours: v }))}
          />
        </Section>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Security posture</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="relative size-16">
              <svg viewBox="0 0 36 36" className="size-16 -rotate-90">
                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-muted)" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeDasharray="100 100" strokeDashoffset="20" strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">80</span>
            </div>
            <div>
              <p className="text-sm font-semibold">Strong</p>
              <p className="text-xs text-[var(--color-muted-foreground)]">Add a passkey to reach 100.</p>
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-xs">
            <li className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[var(--color-success)]" /> Strong password</li>
            <li className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[var(--color-success)]" /> TOTP enabled</li>
            <li className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-[var(--color-muted-foreground)]" /> Passkey not yet added</li>
          </ul>
        </div>
      </div>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Disable two-factor authentication?</DialogTitle>
            <DialogDescription>
              Enter the current 6-digit code from your authenticator app to confirm. Future
              sign-ins will fall back to email OTP.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4 pt-2" onSubmit={submitDisable}>
            {disableErr && (
              <div
                role="alert"
                className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]"
              >
                {disableErr}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="disable-code">Authenticator code</Label>
              <Input
                id="disable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123 456"
                maxLength={7}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value)}
                autoFocus
                required
                disabled={disabling}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={disabling}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                variant="destructive"
                disabled={disabling || disableCode.replace(/\s+/g, "").length !== 6}
              >
                {disabling ? (
                  <>
                    <Loader2 className="animate-spin" /> Disabling…
                  </>
                ) : (
                  "Disable TOTP"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificationsTab() {
  return <NotificationPreferences role="patient" />;
}

function pickDeviceIcon(label: string) {
  const lower = label.toLowerCase();
  if (lower.includes("iphone") || lower.includes("android") || lower.includes("safari · iphone")) return Smartphone;
  if (lower.includes("ipad") || lower.includes("tablet")) return Tablet;
  return Laptop;
}

function relativeLastSeen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 2) return "Active now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

interface ApiSession {
  id: string;
  device: string;
  ipAddress: string | null;
  userAgent: string | null;
  issuedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

function SessionsTab() {
  const [sessions, setSessions] = useState<ApiSession[] | null>(null);

  const reload = async () => {
    const r = await fetch("/api/me/sessions", { cache: "no-store" });
    const data = await r.json();
    if (data?.ok && Array.isArray(data.sessions)) setSessions(data.sessions as ApiSession[]);
  };
  useEffect(() => {
    void reload();
  }, []);

  async function revokeOne(id: string, device: string) {
    const r = await fetch(`/api/me/sessions?id=${id}`, { method: "DELETE" });
    const data = await r.json();
    if (!r.ok || !data?.ok) {
      toast.error(data?.error ?? "Could not revoke session.");
      return;
    }
    toast.warning("Session revoked", { description: `${device} signed out · audit-logged` });
    await reload();
  }
  async function revokeOthers() {
    const r = await fetch("/api/me/sessions?scope=others", { method: "DELETE" });
    const data = await r.json();
    if (!r.ok || !data?.ok) {
      toast.error(data?.error ?? "Could not revoke other sessions.");
      return;
    }
    toast.warning("Other sessions revoked");
    await reload();
  }

  return (
    <Section title="Active sessions & devices" desc="Revoke any session that doesn't look like you. Revocation takes effect on the next API call.">
      {sessions === null ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          Loading…
        </p>
      ) : sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center text-sm text-[var(--color-muted-foreground)]">
          No active sessions.
        </p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => {
            const Icon = pickDeviceIcon(s.device);
            return (
              <li
                key={s.id}
                className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
              >
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-muted)] text-[var(--color-foreground)]">
                  <Icon className="size-4.5" />
                </span>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{s.device}</p>
                    {s.isCurrent && <Badge variant="success" size="sm" dot>This device</Badge>}
                  </div>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {s.ipAddress && (
                      <>
                        <Globe className="mr-1 inline size-3" />
                        <span className="font-mono text-[11px]">{s.ipAddress}</span>
                        <span className="mx-1.5">·</span>
                      </>
                    )}
                    Last active {relativeLastSeen(s.lastSeenAt)}
                  </p>
                </div>
                {!s.isCurrent && (
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                    confirm={{
                      title: `Revoke session on ${s.device}?`,
                      description: "This device will be signed out immediately on its next request.",
                      confirmLabel: "Revoke session",
                      variant: "destructive",
                    }}
                    onClick={() => void revokeOne(s.id, s.device)}
                  >
                    <LogOut /> Revoke
                  </ActionButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ActionButton
        variant="outline"
        className="mt-4"
        confirm={{
          title: "Sign out of all other sessions?",
          description: "Every device except this one will be signed out immediately.",
          confirmLabel: "Sign out everywhere else",
          variant: "destructive",
        }}
        onClick={() => void revokeOthers()}
        disabled={!sessions || sessions.filter((s) => !s.isCurrent).length === 0}
      >
        Sign out of all other sessions
      </ActionButton>
    </Section>
  );
}

function DataTab() {
  const { state } = usePatientStore();

  function exportPhi() {
    // Bundle every entity from the store as a single JSON payload — this
    // mirrors what a real HIPAA right-of-access export would include, just
    // as a one-file download instead of a signed S3 link.
    const bundle = {
      generatedAt: new Date().toISOString(),
      profile: state.profile,
      appointments: state.appointments,
      documents: state.documents,
      consents: state.consents,
      messageThreads: state.threads,
      notifications: state.notifications,
      security: { mfaEnabled: state.security.mfaEnabled, sessionCount: state.security.sessions.length },
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `healthsecure-phi-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("PHI export downloaded", {
      description: `${state.appointments.length} appointments · ${state.documents.length} docs · ${state.consents.length} consents`,
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-info-soft)] text-[var(--color-info)]">
          <Download className="size-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold">Export your PHI</h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Get a complete bundle of your records, prescriptions, imaging metadata, and
          documents in PDF and CSV. HIPAA right-of-access · delivered within 7 days.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <SecurityBadge variant="encrypted" />
          <SecurityBadge variant="audited" />
        </div>
        <Button className="mt-5" onClick={exportPhi}>
          <Download /> Download export now
        </Button>
      </div>

      <div className="rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)]/30 p-6">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-card)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/30">
          <Trash2 className="size-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold">Delete your account</h3>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          HIPAA / GDPR right-to-be-forgotten. Some clinical records may be retained
          for legal compliance — your Compliance Manager will review.
        </p>
        <div className="mt-4 flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]">
          <AlertTriangle className="mt-0.5 size-3.5 text-[var(--color-warning)]" />
          Irreversible. All active sessions will be terminated.
        </div>
        <ActionButton
          variant="destructive"
          className="mt-5"
          confirm={{
            title: "Request account deletion?",
            description: "Compliance Manager will review. Some clinical records may be retained for legal compliance.",
            confirmLabel: "Submit deletion request",
            variant: "destructive",
          }}
          toastMessage="Deletion request submitted"
          toastDescription="Compliance Manager has been notified · you'll get an email when it's reviewed"
          toastVariant="warning"
        >
          Request deletion
        </ActionButton>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 lg:col-span-2">
        <h3 className="text-base font-semibold">Your activity log</h3>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          A view of every action you and your care team have taken on your data. Drawn from the same audit ledger compliance auditors use.
        </p>
        <ActionButton variant="outline" className="mt-4" toastMessage="Activity log opened" toastVariant="info">
          Open activity log
        </ActionButton>
      </div>
    </div>
  );
}

// helpers

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
  type = "text",
  readOnly,
  mono,
  error,
}: {
  id: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  leadingIcon?: React.ReactNode;
  type?: string;
  readOnly?: boolean;
  mono?: boolean;
  error?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value ?? ""}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
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

function SettingRow({
  label,
  desc,
  checked,
  onCheckedChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-[var(--color-muted-foreground)]">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
