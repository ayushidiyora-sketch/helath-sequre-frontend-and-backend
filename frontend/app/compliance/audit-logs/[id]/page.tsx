import Link from "next/link";
import {
  ArrowLeft,
  ScrollText,
  Globe,
  Monitor,
  Clock,
  Hash,
  User,
  Download,
  XCircle,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ReportDownloadButton } from "@/components/shared/report-download-button";

export default async function AuditEventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionId = "sess_4f12a3";
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/compliance/audit-logs" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Audit ledger
        </Link>
        <span>/</span>
        <span className="font-mono text-xs">{id}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-danger-soft)]/30 p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--color-card)] text-[var(--color-danger)] ring-1 ring-[var(--color-danger)]/30">
                  <XCircle className="size-5" />
                </span>
                <div>
                  <Badge variant="danger" size="sm" dot>Denied · consent_revoked</Badge>
                  <h1 className="mt-1 text-lg font-semibold tracking-tight">records.read denied</h1>
                </div>
              </div>
              <SecurityBadge variant="audited" />
            </div>
            <dl className="grid gap-0 sm:grid-cols-2">
              {[
                { icon: User, label: "Actor", value: "priya.shah@citygeneral", sub: "Clinician · usr_p_shah" },
                { icon: Clock, label: "Occurred at", value: "May 18 · 12:03:52 UTC", sub: "Sequence #8b19" },
                { icon: Globe, label: "Source IP", value: "10.0.0.42", sub: "Hospital LAN · trusted range" },
                { icon: Monitor, label: "User agent", value: "Chrome 128 · macOS 14.5", sub: "Workstation · trusted device" },
                { icon: Hash, label: "Resource", value: "rec-img-0501", sub: "Imaging · Chest X-ray · Aarav Mehta" },
                { icon: ScrollText, label: "Session", value: sessionId, sub: "Issued 4h 12m ago · TLS 1.3" },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.label} className="border-b border-r border-[var(--color-border)] p-5 last:border-r-0">
                    <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                      <Icon className="size-3.5" /> {f.label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold">{f.value}</dd>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">{f.sub}</p>
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h2 className="text-sm font-semibold">Event payload (redacted)</h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">PHI is masked. Original payload remains in encrypted form.</p>
            <pre className="mt-3 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]/40 p-4 text-[11px] leading-relaxed font-mono">
{`{
  "id": "${id}",
  "organization_id": "org_acme",
  "actor_id": "usr_p_shah",
  "actor_role": "Clinician",
  "action": "records.read",
  "resource_type": "medical_record",
  "resource_id": "rec-img-0501",
  "status": "denied",
  "reason": "consent_revoked",
  "metadata": {
    "consent_id": "cns_8a90c",
    "consent_revoked_at": "2026-05-18T12:03:51Z",
    "category": "Imaging",
    "patient_id_hash": "phi_redacted"
  },
  "ip_address": "10.0.0.42",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Chrome/128",
  "session_id": "sess_4f12a3",
  "request_id": "req_3a91e",
  "occurred_at": "2026-05-18T12:03:52.184Z"
}`}
            </pre>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <h3 className="text-sm font-semibold">Chain of custody</h3>
            <dl className="mt-3 space-y-2.5 text-xs">
              <Row label="Event ID" value={id} mono />
              <Row label="Request ID" value="req_3a91e" mono />
              <Row label="Session ID" value="sess_4f12a3" mono />
              <Row label="Checksum" value="d4f1 · 9bb0" mono />
              <Row label="Window root" value="ff21 · 0c12" mono />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <SecurityBadge variant="encrypted" />
              <SecurityBadge variant="verified" />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-50)]/40 p-5">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">
              <Layers className="size-3.5" /> Same session
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              See every other event recorded under <span className="font-mono font-semibold text-[var(--color-foreground)]">{sessionId}</span> — useful when investigating intent (was this one denial part of a wider pattern?).
            </p>
            <Button asChild size="sm" className="mt-3 w-full">
              <Link href={`/compliance/audit-logs?session=${sessionId}`}>
                View all events from same session <ArrowRight />
              </Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Linked context</p>
            <ul className="mt-3 space-y-1.5 font-mono text-[var(--color-muted-foreground)]">
              <li>Consent record · cns_8a90c</li>
              <li>Patient · Aarav Mehta (Imaging)</li>
            </ul>
            <ReportDownloadButton
              report="access_report"
              format="pdf"
              variant="outline"
              size="sm"
              className="mt-4 w-full"
            >
              <Download /> Export event chain
            </ReportDownloadButton>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={`text-right font-medium ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
