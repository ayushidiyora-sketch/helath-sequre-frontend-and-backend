"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Mail,
  MessageSquare,
  Bell,
  Plus,
  Code2,
  Eye,
  CheckCircle2,
  History,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea, Input, Label } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionButton } from "@/components/shared/action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useAdminStore } from "@/lib/admin-store";

type Channel = "email" | "sms" | "inapp";

type Template = {
  id: string;
  name: string;
  channels: Channel[];
  version: number;
  active: boolean;
  subject?: string;
  body: string;
  /** SMS char limit */
  smsLimit?: number;
};

const VARIABLES_BY_CHANNEL: Record<Channel, string> = {
  email: "patient.*, appointment.*, organization.*, clinic.*",
  sms: "patient.first_name, appointment.title, appointment.time, organization.short_name",
  inapp: "patient.*, action_url, category, priority",
};

const TEMPLATES: Template[] = [
  {
    id: "t-appt-24h-email",
    name: "Appointment reminder T-24h",
    channels: ["email"],
    version: 4,
    active: true,
    subject: "Reminder: {{appointment.title}} tomorrow at {{appointment.time}}",
    body: `Hi {{patient.first_name}},

This is a friendly reminder for your appointment:

  • {{appointment.title}}
  • {{appointment.clinician}}
  • {{appointment.date}} at {{appointment.time}}
  • {{appointment.location}}

Reply CANCEL to cancel, or visit your portal to reschedule.

— {{organization.name}}`,
  },
  {
    id: "t-appt-1h-sms",
    name: "Appointment reminder T-1h",
    channels: ["sms"],
    version: 2,
    active: true,
    smsLimit: 160,
    body:
      "{{organization.short_name}}: {{appointment.title}} at {{appointment.time}} today. Reply C to cancel.",
  },
  {
    id: "t-appt-confirmed",
    name: "Appointment confirmed",
    channels: ["email", "inapp"],
    version: 3,
    active: true,
    subject: "Confirmed: {{appointment.title}} on {{appointment.date}}",
    body: `Hi {{patient.first_name}},

Your appointment is confirmed.

  • Clinician: {{appointment.clinician}}
  • When: {{appointment.date}} at {{appointment.time}}
  • Where: {{appointment.location}}

We'll send reminders at T-24h and T-1h.

— {{organization.name}}`,
  },
  {
    id: "t-reschedule-req",
    name: "Reschedule request",
    channels: ["email"],
    version: 2,
    active: true,
    subject: "Your {{appointment.title}} has been rescheduled",
    body: `Hi {{patient.first_name}},

Your appointment has been rescheduled:

  Old: {{appointment.old_date}} at {{appointment.old_time}}
  New: {{appointment.date}} at {{appointment.time}}

If this doesn't work, please open your portal to pick another slot.

— {{organization.name}}`,
  },
  {
    id: "t-consent-request",
    name: "New consent request",
    channels: ["email", "inapp"],
    version: 5,
    active: true,
    subject: "{{clinician.name}} is requesting access to your {{consent.scope}}",
    body: `Hi {{patient.first_name}},

{{clinician.name}} has requested access to your {{consent.scope}} records under policy {{consent.policy_version}}.

You can review and approve / decline this request from your portal:
{{action_url}}

This message is sent because you have an active care relationship with {{organization.name}}. You can revoke any consent at any time.`,
  },
  {
    id: "t-password-reset",
    name: "Password reset",
    channels: ["email"],
    version: 6,
    active: true,
    subject: "Reset your {{organization.name}} password",
    body: `Hi {{patient.first_name}},

We received a request to reset your password. Click below to set a new one:

{{action_url}}

This link expires in 30 minutes and can only be used once. If you didn't request this, you can safely ignore this email.

— {{organization.name}} security team`,
  },
  {
    id: "t-welcome",
    name: "Welcome (patient invitation)",
    channels: ["email"],
    version: 8,
    active: true,
    subject: "Welcome to {{organization.name}} · accept your invitation",
    body: `Hi {{patient.first_name}},

{{organization.name}} has invited you to the HealthSecure patient portal.

Accept your invitation here (link expires in 72 hours):
{{action_url}}

You'll set a password, optionally enable two-factor authentication, and review the active consent policy before your first sign-in.

Need help? Reply to this email and our care coordinator will assist.

— {{organization.name}}`,
  },
  {
    id: "t-mfa-reminder",
    name: "MFA enrollment reminder",
    channels: ["email"],
    version: 1,
    active: false,
    subject: "Add two-factor authentication to your account",
    body: `Hi {{patient.first_name}},

Two-factor authentication adds an extra layer of security to your account. It only takes 60 seconds to set up.

Enable now: {{action_url}}

— {{organization.name}} security team`,
  },
  {
    id: "t-new-record-inapp",
    name: "New record available",
    channels: ["inapp", "email"],
    version: 2,
    active: true,
    subject: "{{clinician.name}} added a new record to your chart",
    body: `Hi {{patient.first_name}},

{{clinician.name}} has finalized a new {{record.category}} record on {{record.date}}.

Open your portal to view: {{action_url}}`,
  },
  {
    id: "t-anomaly-alert",
    name: "Anomaly detected",
    channels: ["inapp", "email"],
    version: 3,
    active: true,
    subject: "[Compliance] Anomaly detected · {{anomaly.severity}}",
    body: `An anomaly was detected on {{anomaly.detected_at}}:

  Severity: {{anomaly.severity}}
  Pattern: {{anomaly.pattern}}
  Actor: {{anomaly.actor}}
  Events: {{anomaly.event_count}}

Review in the compliance dashboard: {{action_url}}`,
  },
  {
    id: "t-suspicious-login",
    name: "Suspicious activity alert",
    channels: ["email", "inapp"],
    version: 4,
    active: true,
    subject: "Sign-in from a new device on your account",
    body: `Hi {{patient.first_name}},

We noticed a sign-in to your account from a new device:

  Device: {{session.device}}
  Location: {{session.location}}
  Time: {{session.signed_in_at}}

If this was you, no action needed. If not, revoke the session and change your password immediately:
{{action_url}}`,
  },
];

const CHANNEL_META: Record<Channel, { label: string; icon: typeof Mail }> = {
  email: { label: "Email", icon: Mail },
  sms: { label: "SMS", icon: MessageSquare },
  inapp: { label: "In-app", icon: Bell },
};

function channelSummary(channels: Channel[]): string {
  return channels.map((c) => CHANNEL_META[c].label).join(" + ");
}

export default function AdminTemplatesPage() {
  const { addTemplate, markOnboardingStep } = useAdminStore();
  const [activeChannel, setActiveChannel] = useState<Channel>("email");
  const filtered = useMemo(
    () => TEMPLATES.filter((t) => t.channels.includes(activeChannel)),
    [activeChannel],
  );
  const [selectedId, setSelectedId] = useState<string>(filtered[0]?.id ?? "");
  const selected = TEMPLATES.find((t) => t.id === selectedId) ?? filtered[0];

  // Editor state — reset when selection changes
  const [subject, setSubject] = useState(selected?.subject ?? "");
  const [body, setBody] = useState(selected?.body ?? "");
  const [dirty, setDirty] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // When activeChannel changes, default to first template in that channel
  const handleChannelChange = (ch: Channel) => {
    setActiveChannel(ch);
    const first = TEMPLATES.find((t) => t.channels.includes(ch));
    if (first) {
      selectTemplate(first.id);
    }
  };

  const selectTemplate = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    if (dirty) {
      toast.warning("Discarded unsaved changes", { description: tpl.name });
    }
    setSelectedId(id);
    setSubject(tpl.subject ?? "");
    setBody(tpl.body);
    setDirty(false);
  };

  const onDiscard = () => {
    if (!selected) return;
    setSubject(selected.subject ?? "");
    setBody(selected.body);
    setDirty(false);
    toast.info("Changes discarded", { description: selected.name });
  };

  const onSave = () => {
    if (!selected) return;
    // Persist a custom template snapshot into the admin store so the audit
    // ledger captures this edit and the templates pool grows over time.
    addTemplate({
      name: selected.name,
      type: "custom",
      subject,
      body,
      channels: selected.channels.map((c) => (c === "inapp" ? "in_app" : c)) as ("email" | "sms" | "in_app")[],
      active: selected.active,
    });
    markOnboardingStep("templatesConfigured", true);
    toast.success(`${selected.name} saved as v${selected.version + 1}`, {
      description: "Previous version retained for audit",
    });
    setDirty(false);
  };

  return (
    <>
      <PageHeader
        eyebrow="Templates"
        title="Notification templates"
        description="Versioned email, SMS, and in-app message templates. Previous versions are retained for audit."
        actions={
          <ActionButton
            size="sm"
            toastMessage="New template draft created · v1"
            toastDescription="Edit on the right panel"
          >
            <Plus /> New template
          </ActionButton>
        }
      />

      <Tabs value={activeChannel} onValueChange={(v) => handleChannelChange(v as Channel)}>
        <TabsList>
          {(Object.keys(CHANNEL_META) as Channel[]).map((c) => {
            const Icon = CHANNEL_META[c].icon;
            const count = TEMPLATES.filter((t) => t.channels.includes(c)).length;
            return (
              <TabsTrigger key={c} value={c}>
                <Icon /> {CHANNEL_META[c].label} · {count}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={activeChannel}>
          <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
            <TemplateList
              templates={filtered}
              selectedId={selected?.id ?? null}
              onSelect={selectTemplate}
            />
            {selected ? (
              <TemplateEditor
                template={selected}
                channel={activeChannel}
                subject={subject}
                body={body}
                dirty={dirty}
                onSubject={(v) => {
                  setSubject(v);
                  setDirty(true);
                }}
                onBody={(v) => {
                  setBody(v);
                  setDirty(true);
                }}
                onDiscard={onDiscard}
                onSave={onSave}
                onPreview={() => setPreviewOpen(true)}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">
                No templates in this channel yet. Click <span className="font-medium text-[var(--color-foreground)]">New template</span> to start.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {selected && (
        <PreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          template={selected}
          channel={activeChannel}
          subject={subject}
          body={body}
        />
      )}
    </>
  );
}

/* ============================================================================
   Template list (left rail)
============================================================================ */

function TemplateList({
  templates,
  selectedId,
  onSelect,
}: {
  templates: Template[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <ul className="divide-y divide-[var(--color-border)]">
        {templates.map((t) => {
          const ChannelIcon = CHANNEL_META[t.channels[0]].icon;
          const isSelected = t.id === selectedId;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 p-4 text-left transition-colors",
                  isSelected
                    ? "bg-[var(--color-primary-50)]/60"
                    : "hover:bg-[var(--color-muted)]/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    isSelected
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]",
                  )}
                >
                  <ChannelIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm",
                      isSelected ? "font-semibold text-[var(--color-primary-700)]" : "font-medium",
                    )}
                  >
                    {t.name}
                  </p>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">
                    {channelSummary(t.channels)} · v{t.version}
                  </p>
                </div>
                {t.active ? (
                  <Badge variant="success" size="sm" dot>
                    Active
                  </Badge>
                ) : (
                  <Badge variant="muted" size="sm">
                    Draft
                  </Badge>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ============================================================================
   Template editor (right panel)
============================================================================ */

function TemplateEditor({
  template,
  channel,
  subject,
  body,
  dirty,
  onSubject,
  onBody,
  onDiscard,
  onSave,
  onPreview,
}: {
  template: Template;
  channel: Channel;
  subject: string;
  body: string;
  dirty: boolean;
  onSubject: (v: string) => void;
  onBody: (v: string) => void;
  onDiscard: () => void;
  onSave: () => void;
  onPreview: () => void;
}) {
  const limit = channel === "sms" ? template.smsLimit ?? 160 : null;
  const bodyChars = body.length;
  const overLimit = limit !== null && bodyChars > limit;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {template.name} · v{template.version}
            </h3>
            {dirty && (
              <Badge variant="warning" size="sm" dot>
                Unsaved
              </Badge>
            )}
            <Badge variant="muted" size="sm">
              {channelSummary(template.channels)}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" type="button">
              <History /> History
            </Button>
            <Button variant="ghost" size="sm" type="button" onClick={onPreview}>
              <Eye /> Preview
            </Button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {channel !== "sms" && (
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => onSubject(e.target.value)}
                placeholder="Subject line — supports {{variables}}"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Body</Label>
              {limit !== null && (
                <span
                  className={cn(
                    "text-[10px] font-mono",
                    overLimit ? "text-[var(--color-danger)]" : "text-[var(--color-muted-foreground)]",
                  )}
                >
                  {bodyChars} / {limit} chars
                </span>
              )}
            </div>
            <Textarea
              rows={channel === "sms" ? 4 : 10}
              value={body}
              onChange={(e) => onBody(e.target.value)}
              placeholder="Message body — supports {{variables}}"
              className={cn(overLimit && "border-[var(--color-danger)] focus:border-[var(--color-danger)]")}
            />
          </div>
          <div className="flex items-center gap-2">
            <Code2 className="size-4 text-[var(--color-muted-foreground)]" />
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Variables available: {VARIABLES_BY_CHANNEL[channel]}
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard} disabled={!dirty}>
            Discard
          </Button>
          <Button size="sm" onClick={onSave} disabled={!dirty || overLimit}>
            <CheckCircle2 /> Save as v{template.version + 1}
          </Button>
        </div>
      </div>

      {/* Version trail */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            Version history
          </p>
          <Badge variant="muted" size="sm">
            {template.version} versions
          </Badge>
        </div>
        <ol className="mt-3 space-y-2">
          {Array.from({ length: Math.min(template.version, 3) }).map((_, i) => {
            const v = template.version - i;
            const isCurrent = v === template.version;
            return (
              <li
                key={v}
                className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-2.5 text-xs"
              >
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md font-mono font-semibold",
                    isCurrent
                      ? "bg-[var(--color-success)] text-white"
                      : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
                  )}
                >
                  v{v}
                </span>
                <div className="flex-1">
                  <p className={cn("font-medium", isCurrent && "text-[var(--color-success)]")}>
                    {isCurrent ? "Current · active" : "Archived"}
                  </p>
                  <p className="text-[10px] text-[var(--color-muted-foreground)]">
                    {isCurrent ? "Saved by Maya Iyer · 4 days ago" : `Replaced ${i * 18 + 4} days ago`}
                  </p>
                </div>
                {!isCurrent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={() =>
                      toast.success(`Restored ${template.name} to v${v}`, {
                        description: "v" + v + " is now active · later versions retained for audit",
                      })
                    }
                  >
                    Restore
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ============================================================================
   Preview dialog — fills variables with demo data
============================================================================ */

const SAMPLE_VARS: Record<string, string> = {
  "patient.first_name": "Aarav",
  "patient.last_name": "Mehta",
  "appointment.title": "Cardiology follow-up",
  "appointment.clinician": "Dr. Priya Shah",
  "appointment.date": "Mon, May 25",
  "appointment.time": "9:30 AM",
  "appointment.location": "Room 304",
  "appointment.old_date": "Wed, May 20",
  "appointment.old_time": "11:00 AM",
  "clinician.name": "Dr. Neha Kapoor",
  "consent.scope": "Imaging",
  "consent.policy_version": "v2.4",
  "organization.name": "City General Hospital",
  "organization.short_name": "CityGen",
  "action_url": "https://portal.healthsecure.app/p/a8f9",
  "record.category": "Lab Report",
  "record.date": "May 18, 2026",
  "anomaly.severity": "High",
  "anomaly.pattern": "Bulk download",
  "anomaly.actor": "Dr. K. Patel",
  "anomaly.detected_at": "May 18, 2026 · 02:14 IST",
  "anomaly.event_count": "32",
  "session.device": "Chrome · Windows",
  "session.location": "Mumbai, India",
  "session.signed_in_at": "May 18, 2026 · 8:04 AM IST",
};

function fillVars(text: string): string {
  return text.replace(/\{\{([\w.]+)\}\}/g, (_, k) => SAMPLE_VARS[k] ?? `«${k}»`);
}

function PreviewDialog({
  open,
  onOpenChange,
  template,
  channel,
  subject,
  body,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template: Template;
  channel: Channel;
  subject: string;
  body: string;
}) {
  const Icon = CHANNEL_META[channel].icon;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="size-4 text-[var(--color-primary-700)]" />
            Preview · {template.name}
          </DialogTitle>
          <DialogDescription>
            Variables filled with sample patient data. No PHI is sent during preview.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/30">
          {channel === "email" && (
            <>
              <div className="border-b border-[var(--color-border)] p-3 text-xs space-y-1">
                <Row label="From" value="ops@citygeneral.health" />
                <Row label="To" value="aarav.mehta@example.com" />
                <Row label="Subject" value={fillVars(subject)} bold />
              </div>
              <pre className="whitespace-pre-wrap p-4 text-sm leading-relaxed font-sans text-[var(--color-foreground)]">
                {fillVars(body)}
              </pre>
            </>
          )}
          {channel === "sms" && (
            <div className="mx-auto max-w-xs p-6">
              <div className="rounded-2xl bg-[var(--color-primary)] p-3 text-sm text-white shadow-[var(--shadow-soft)]">
                {fillVars(body)}
              </div>
              <p className="mt-2 text-center text-[10px] text-[var(--color-muted-foreground)]">
                {body.length} / 160 chars · {body.length > 160 ? Math.ceil(body.length / 160) : 1} SMS segment
                {body.length > 160 ? "s" : ""}
              </p>
            </div>
          )}
          {channel === "inapp" && (
            <div className="p-4">
              <div className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 shadow-[var(--shadow-soft)]">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                  <FileText className="size-4" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{fillVars(subject)}</p>
                  <pre className="mt-1 whitespace-pre-wrap text-xs leading-relaxed font-sans text-[var(--color-muted-foreground)]">
                    {fillVars(body)}
                  </pre>
                  <p className="mt-2 text-[10px] text-[var(--color-muted-foreground)]">Just now</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              toast.success("Test send queued", { description: "Sent to your address only · audit-logged" });
              onOpenChange(false);
            }}
          >
            Send test to me
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 text-[var(--color-muted-foreground)]">{label}</span>
      <span className={cn("flex-1 break-words", bold && "font-semibold")}>{value}</span>
    </div>
  );
}
