"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  PencilLine,
  Clock,
  ScrollText,
  ClipboardList,
  Activity,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ConsentDeniedCard } from "@/components/shared/consent-denied-card";
import { PageHeader } from "@/components/shared/page-header";
import { RequestAccessDialog } from "../request-access-dialog";
import {
  useClinicianStore,
  hasEffectiveConsent,
  activeApprovedRequest,
  pendingRequest,
  type AssignedPatient,
  type ClinicianNote,
  type NoteTemplate,
} from "@/lib/clinician-store";

const TEMPLATE_FILTERS: { value: "all" | NoteTemplate; label: string }[] = [
  { value: "all", label: "All templates" },
  { value: "SOAP", label: "SOAP" },
  { value: "Progress", label: "Progress" },
  { value: "Discharge", label: "Discharge" },
  { value: "Consult", label: "Consult" },
];

const STATUS_FILTERS: { value: "all" | "draft" | "finalized"; label: string }[] = [
  { value: "all", label: "All status" },
  { value: "draft", label: "Drafts only" },
  { value: "finalized", label: "Finalized only" },
];

function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function templateBlurb(n: ClinicianNote): string {
  const parts = [n.subjective, n.objective, n.assessment, n.plan, n.body].filter((p): p is string => Boolean(p));
  const joined = parts.join(" · ");
  return joined.length > 160 ? `${joined.slice(0, 160).trimEnd()}…` : joined;
}

export default function PatientRecordsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, simulateApprovalDecision } = useClinicianStore();

  const [query, setQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState<"all" | NoteTemplate>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "finalized">("all");
  const [requestOpen, setRequestOpen] = useState(false);

  // DB-fallback for the patient lookup (matches main chart + timeline page).
  const [apiPatient, setApiPatient] = useState<AssignedPatient | null>(null);
  const [apiResolved, setApiResolved] = useState<"pending" | "found" | "missing">("pending");
  const storeHas = state.hydrated && state.assignedPatients.some((p) => p.id === id);
  useEffect(() => {
    if (storeHas || !state.hydrated) return;
    let cancelled = false;
    fetch(`/api/clinician/patients/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (!r.ok || !data.ok) { setApiResolved("missing"); return; }
        const p = data.patient;
        setApiPatient({
          id: p.id, mrn: p.mrn, name: p.name, initials: p.initials,
          age: p.age ?? 0,
          sex: (p.sex === "M" ? "M" : p.sex === "F" ? "F" : "Other") as "M" | "F" | "Other",
          email: p.email, phone: p.phone ?? "", assignedAt: p.startedAt,
          consentScopes: [], consentStatus: "active", conditions: [], allergies: [],
        });
        setApiResolved("found");
      })
      .catch(() => { if (!cancelled) setApiResolved("missing"); });
    return () => { cancelled = true; };
  }, [id, storeHas, state.hydrated]);

  const patient = state.hydrated
    ? state.assignedPatients.find((p) => p.id === id) ?? apiPatient ?? undefined
    : undefined;

  const allNotes = useMemo(
    () => (patient ? state.notes.filter((n) => n.patientId === patient.id) : []),
    [patient, state.notes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allNotes
      .filter((n) => (templateFilter === "all" ? true : n.template === templateFilter))
      .filter((n) => (statusFilter === "all" ? true : n.status === statusFilter))
      .filter((n) => {
        if (!q) return true;
        return (
          n.id.toLowerCase().includes(q) ||
          n.template.toLowerCase().includes(q) ||
          [n.subjective, n.objective, n.assessment, n.plan, n.body]
            .filter((s): s is string => Boolean(s))
            .some((s) => s.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => (b.finalizedAt ?? b.updatedAt).localeCompare(a.finalizedAt ?? a.updatedAt));
  }, [allNotes, query, templateFilter, statusFilter]);

  if (!state.hydrated || (!storeHas && apiResolved === "pending")) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
        Loading…
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
          <Link href="/clinician/patients" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
            <ArrowLeft className="size-3.5" /> Patient panel
          </Link>
          <span>/</span>
          <span className="font-mono text-xs">{id}</span>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
          <ClipboardList className="size-6 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-medium">Patient not on your panel</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            You don&apos;t have an assignment for <code className="font-mono">{id}</code>. Request assignment from your Org Admin.
          </p>
          <Button asChild size="sm"><Link href="/clinician/patients">Back to panel</Link></Button>
        </div>
      </div>
    );
  }

  const canViewNotes = hasEffectiveConsent(state, patient.id, "notes");
  const canViewLab = hasEffectiveConsent(state, patient.id, "lab");
  const canView = canViewNotes || canViewLab;
  const activeGrant = activeApprovedRequest(state, patient.id);
  const pending = pendingRequest(state, patient.id);

  const stats = {
    total: allNotes.length,
    finalized: allNotes.filter((n) => n.status === "finalized").length,
    draft: allNotes.filter((n) => n.status === "draft").length,
    bySoap: allNotes.filter((n) => n.template === "SOAP").length,
  };

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/clinician/patients" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Patient panel
        </Link>
        <span>/</span>
        <Link href={`/clinician/patients/${patient.id}`} className="hover:text-[var(--color-foreground)]">
          {patient.name}
        </Link>
        <span>/</span>
        <span className="text-[var(--color-foreground)]">Records</span>
      </div>

      <PageHeader
        eyebrow="Clinical records"
        title={`${patient.name} · Records`}
        description="Clinical notes, assessments, and finalized encounter documentation. Every view and edit is audit-logged."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`/clinician/patients/${patient.id}`}>
                <Stethoscope /> Back to chart
              </Link>
            </Button>
            <Button asChild size="sm" disabled={!canViewNotes}>
              <Link href={`/clinician/notes/new?patient=${patient.id}`}>
                <Plus /> New SOAP note
              </Link>
            </Button>
          </>
        }
      />

      {/* Patient identity strip */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-card)] to-[oklch(0.96_0.025_235)] p-4">
        <Avatar className="size-12"><AvatarFallback>{patient.initials}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{patient.name}</p>
            <Badge variant="muted" size="sm">{patient.age} · {patient.sex}</Badge>
            <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{patient.mrn}</span>
            {patient.consentStatus === "active" ? (
              <SecurityBadge variant="consent-bound" />
            ) : (
              <Badge variant="danger" size="sm" dot>Consent revoked</Badge>
            )}
          </div>
          {patient.allergies && patient.allergies.length > 0 && (
            <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
              Allergies: <span className="font-medium text-[var(--color-danger)]">{patient.allergies.join(", ")}</span>
            </p>
          )}
        </div>
        {activeGrant && (
          <Badge variant="success" size="sm" dot>Temp. access granted</Badge>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={ScrollText} label="Total records" value={stats.total} />
        <Stat icon={CheckCircle2} label="Finalized" value={stats.finalized} tone="success" />
        <Stat icon={PencilLine} label="Drafts" value={stats.draft} tone="warning" />
        <Stat icon={Activity} label="SOAP notes" value={stats.bySoap} />
      </div>

      {/* Records body — gated on consent */}
      {!canView ? (
        <ConsentDeniedCard
          category="Records"
          onRequestAccess={pending ? undefined : () => setRequestOpen(true)}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Search records by template, content, or ID…"
              leadingIcon={<Search />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:max-w-md"
            />
            <Tabs value={templateFilter} onValueChange={(v) => setTemplateFilter(v as "all" | NoteTemplate)}>
              <TabsList>
                {TEMPLATE_FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | "draft" | "finalized")}>
              <TabsList>
                {STATUS_FILTERS.map((f) => (
                  <TabsTrigger key={f.value} value={f.value}>{f.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
              <FileText className="size-6 text-[var(--color-muted-foreground)]" />
              <p className="text-sm font-medium">
                {allNotes.length === 0 ? "No records for this patient yet" : "No records match the current filters"}
              </p>
              <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
                {allNotes.length === 0
                  ? "Create the first clinical note from this patient's chart."
                  : "Try clearing search or switching template/status filters."}
              </p>
              {allNotes.length === 0 ? (
                <Button asChild size="sm">
                  <Link href={`/clinician/notes/new?patient=${patient.id}`}><Plus /> Create first note</Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setTemplateFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  <Filter /> Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                  {filtered.length} record{filtered.length === 1 ? "" : "s"}
                </p>
                <SecurityBadge variant="audited" />
              </div>
              <ul className="divide-y divide-[var(--color-border)]">
                {filtered.map((n) => (
                  <li key={n.id} className="flex items-start gap-4 p-5 hover:bg-[var(--color-muted)]/40">
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                      <FileText className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{n.template} note · v{n.version}</p>
                        {n.status === "finalized" ? (
                          <Badge variant="success" size="sm" dot>Finalized</Badge>
                        ) : (
                          <Badge variant="warning" size="sm" dot>Draft</Badge>
                        )}
                      </div>
                      {templateBlurb(n) && (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-muted-foreground)]">{templateBlurb(n)}</p>
                      )}
                      <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                        <Clock className="size-3" />
                        {n.status === "finalized" && n.finalizedAt
                          ? `Finalized ${dateTimeLabel(n.finalizedAt)}`
                          : `Drafted ${dateTimeLabel(n.createdAt)} · last edit ${dateTimeLabel(n.updatedAt)}`}
                        <span>· </span>
                        <span className="font-mono">{n.id}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {n.status === "draft" ? (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/clinician/notes/new?patient=${patient.id}&note=${n.id}`}>Edit</Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/clinician/notes/new?patient=${patient.id}&note=${n.id}`}>View</Link>
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {pending && !canView && (
        <p className="rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/40 px-3.5 py-2.5 text-xs text-[var(--color-warning-foreground)]">
          A sensitive-access request is already pending Sai&apos;s review for this patient. The records list will unlock once approved.
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => simulateApprovalDecision(pending.id, "approve", "Approved by Sai (demo simulation).")}
          >
            (demo) Simulate approval
          </Button>
        </p>
      )}

      <RequestAccessDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        patient={patient}
        initialScope="notes"
      />
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  const ring =
    tone === "success"
      ? "text-[var(--color-success)] bg-[var(--color-success-soft)]/50"
      : tone === "warning"
        ? "text-[var(--color-warning-foreground)] bg-[var(--color-warning-soft)]/60"
        : "text-[var(--color-primary-700)] bg-[var(--color-primary-50)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <span className={`flex size-5 items-center justify-center rounded-md ${ring}`}>
          <Icon className="size-3" />
        </span>
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
