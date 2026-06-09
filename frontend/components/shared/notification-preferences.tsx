"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

export interface NotifCategory {
  key: string;
  name: string;
  desc: string;
  /** Critical categories keep in-app + email always on (cannot be disabled). */
  critical?: boolean;
}

type Channel = "inApp" | "email" | "sms";
type ChannelState = Record<Channel, boolean>;
type Prefs = Record<string, ChannelState>;

/** Per-role default category sets. Callers can override via `categories`. */
export const NOTIF_CATEGORIES: Record<string, NotifCategory[]> = {
  patient: [
    { key: "appointments", name: "Appointments", desc: "Reminders, confirmations, reschedules" },
    { key: "records", name: "Records", desc: "New labs, prescriptions, notes" },
    { key: "consents", name: "Consents", desc: "New requests, expirations" },
    { key: "messages", name: "Messages", desc: "Replies from your care team" },
    { key: "security", name: "Security", desc: "Sign-ins, MFA changes, suspicious activity", critical: true },
    { key: "marketing", name: "Marketing", desc: "Product updates and policy changes" },
  ],
  clinician: [
    { key: "appointments", name: "Schedule", desc: "New bookings, reschedules, cancellations" },
    { key: "messages", name: "Messages", desc: "Replies from your patients" },
    { key: "tasks", name: "Tasks & reviews", desc: "Pending notes, signatures, approvals" },
    { key: "consents", name: "Consent requests", desc: "Grants, revocations, expirations" },
    { key: "security", name: "Security", desc: "Sign-ins, MFA changes, suspicious activity", critical: true },
  ],
  admin: [
    { key: "users", name: "Users & staff", desc: "New invites, role changes, deactivations" },
    { key: "appointments", name: "Scheduling", desc: "Clinic-wide schedule changes, conflicts" },
    { key: "reports", name: "Reports", desc: "Scheduled report delivery" },
    { key: "security", name: "Security", desc: "Sign-ins, MFA changes, suspicious activity", critical: true },
    { key: "system", name: "System", desc: "Maintenance windows, platform notices" },
  ],
  compliance: [
    { key: "anomalies", name: "Anomaly alerts", desc: "Off-hours access, bulk downloads, failures" },
    { key: "approvals", name: "Approvals", desc: "Sensitive-data access requests" },
    { key: "reports", name: "Reports", desc: "Compliance & audit report delivery" },
    { key: "security", name: "Security", desc: "Sign-ins, MFA changes, suspicious activity", critical: true },
    { key: "system", name: "System", desc: "Policy changes, platform notices" },
  ],
  auditor: [
    { key: "reports", name: "Report exports", desc: "Export completion, scheduled delivery" },
    { key: "audit", name: "Audit access", desc: "New audit events in watched scopes" },
    { key: "security", name: "Security", desc: "Sign-ins, MFA changes, suspicious activity", critical: true },
    { key: "system", name: "System", desc: "Platform notices" },
  ],
  super: [
    { key: "health", name: "Platform health", desc: "Uptime, performance, degradation" },
    { key: "incidents", name: "Security incidents", desc: "Break-glass, intrusions, escalations", critical: true },
    { key: "tenants", name: "Tenant lifecycle", desc: "Onboarding, suspensions, tier changes" },
    { key: "system", name: "System", desc: "Maintenance, deploys, platform notices" },
  ],
};

function defaultsFor(categories: NotifCategory[]): Prefs {
  const out: Prefs = {};
  for (const c of categories) {
    out[c.key] = { inApp: true, email: !c.critical ? c.key !== "marketing" : true, sms: !!c.critical };
  }
  return out;
}

/**
 * Per-user notification preferences editor — a category × channel (in-app /
 * email / SMS) matrix.
 *
 * Preferences are persisted server-side via `/api/me/notification-preferences`
 * (one row per user in `notification_preferences`, JSONB `prefs` column).
 * Critical categories keep in-app + email always on; the server clamps them
 * too so a tampered request can't disable them.
 */
export function NotificationPreferences({
  role,
  categories,
  title = "Notification preferences",
  description = "Pick the channels for each category. Critical security alerts can't be fully disabled.",
}: {
  role: string;
  categories?: NotifCategory[];
  title?: string;
  description?: string;
}) {
  const cats = useMemo(() => categories ?? NOTIF_CATEGORIES[role] ?? NOTIF_CATEGORIES.patient, [categories, role]);
  const [prefs, setPrefs] = useState<Prefs>(() => defaultsFor(cats));
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load persisted prefs from the API on mount / category-set change.
  useEffect(() => {
    setLoading(true);
    let cancelled = false;
    (async () => {
      const base = defaultsFor(cats);
      let merged: Prefs = base;
      try {
        const r = await fetch("/api/me/notification-preferences", { cache: "no-store" });
        if (r.ok) {
          const j = (await r.json()) as { ok?: boolean; prefs?: Prefs };
          if (j?.ok && j.prefs && typeof j.prefs === "object") {
            merged = { ...base };
            for (const c of cats) {
              if (j.prefs[c.key]) merged[c.key] = { ...base[c.key], ...j.prefs[c.key] };
            }
          }
        }
      } catch {
        // Network blip — keep defaults; user can still edit + save.
      }
      if (cancelled) return;
      setPrefs(merged);
      setSavedSnapshot(JSON.stringify(merged));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [role, cats]);

  const set = (key: string, ch: Channel, v: boolean) =>
    setPrefs((p) => ({ ...p, [key]: { ...p[key], [ch]: v } }));

  const dirty = JSON.stringify(prefs) !== savedSnapshot;

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/me/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prefs, role }),
      });
      const j = (await r.json()) as { ok: boolean; error?: string; prefs?: Prefs };
      if (!r.ok || !j.ok) {
        toast.error("Could not save preferences", {
          description: j.error ?? `HTTP ${r.status}`,
        });
        return;
      }
      // Reflect server-clamped values (critical categories forced on).
      const next = j.prefs ?? prefs;
      setPrefs(next);
      setSavedSnapshot(JSON.stringify(next));
      toast.success("Notification preferences saved", {
        description: "Applied to future notifications · audit-logged",
      });
    } catch (e) {
      toast.error("Could not save preferences", {
        description: e instanceof Error ? e.message : "Network error",
      });
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setPrefs(defaultsFor(cats));
    toast.info("Reset to defaults", { description: "Remember to save." });
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">{description}</p>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading preferences…
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">In-app</th>
                  <th className="px-4 py-3 text-center">Email</th>
                  <th className="px-4 py-3 text-center">SMS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {cats.map((c) => {
                  const row = prefs[c.key] ?? { inApp: true, email: true, sms: false };
                  return (
                    <tr key={c.key}>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{c.name}</p>
                          {c.critical && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/40 px-1.5 py-0.5 text-[10px] font-medium text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]">
                              <Lock className="size-2.5" /> Always on
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-muted-foreground)]">{c.desc}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Switch checked={row.inApp} disabled={c.critical} onCheckedChange={(v) => set(c.key, "inApp", v)} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Switch checked={row.email} disabled={c.critical} onCheckedChange={(v) => set(c.key, "email", v)} />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Switch checked={row.sms} onCheckedChange={(v) => set(c.key, "sms", v)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
            SMS is delivered via your organization&apos;s Twilio integration; carrier rates may apply.
            Security alerts can&apos;t be fully disabled per platform policy.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset} disabled={saving}>
              Reset to defaults
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty || saving}>
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" /> Saving…
                </>
              ) : (
                "Save preferences"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
