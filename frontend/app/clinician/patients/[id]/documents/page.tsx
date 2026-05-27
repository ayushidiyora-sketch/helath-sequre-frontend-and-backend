"use client";

import { use, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardList,
  FileImage,
  Search,
  Filter,
  Upload,
  Beaker,
  FileText,
  HardDrive,
  Stethoscope,
  Clock,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { SecurityBadge } from "@/components/shared/security-badge";
import { ConsentDeniedCard } from "@/components/shared/consent-denied-card";
import { RequestAccessDialog } from "../request-access-dialog";
import {
  useClinicianStore,
  hasEffectiveConsent,
  activeApprovedRequest,
  pendingRequest,
  type ClinicianDocument,
} from "@/lib/clinician-store";

type Category = ClinicianDocument["category"];
type CategoryFilter = "all" | Category;

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Lab Report", label: "Lab" },
  { value: "Imaging", label: "Imaging" },
  { value: "Discharge", label: "Discharge" },
  { value: "Other", label: "Other" },
];

function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function categorizeFromFilename(name: string): Category {
  if (/ecg|x-?ray|mri|scan|imag|ct|ultras/i.test(name)) return "Imaging";
  if (/lab|panel|blood|cbc|lipid/i.test(name)) return "Lab Report";
  if (/discharge|summary/i.test(name)) return "Discharge";
  return "Other";
}

export default function PatientDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { state, uploadDocument, simulateApprovalDecision } = useClinicianStore();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [requestOpen, setRequestOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patient = state.hydrated ? state.assignedPatients.find((p) => p.id === id) : undefined;

  const allDocs = useMemo(
    () => (patient ? state.documents.filter((d) => d.patientId === patient.id) : []),
    [patient, state.documents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allDocs
      .filter((d) => (categoryFilter === "all" ? true : d.category === categoryFilter))
      .filter((d) => (!q ? true : d.name.toLowerCase().includes(q) || d.uploaderName.toLowerCase().includes(q)))
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
  }, [allDocs, query, categoryFilter]);

  if (!state.hydrated) {
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
          <Button asChild size="sm"><Link href="/clinician/patients">Back to panel</Link></Button>
        </div>
      </div>
    );
  }

  const canView = hasEffectiveConsent(state, patient.id, "imaging") || hasEffectiveConsent(state, patient.id, "lab");
  const canUpload = canView;
  const activeGrant = activeApprovedRequest(state, patient.id);
  const pending = pendingRequest(state, patient.id);

  const stats = {
    total: allDocs.length,
    lab: allDocs.filter((d) => d.category === "Lab Report").length,
    imaging: allDocs.filter((d) => d.category === "Imaging").length,
    totalBytes: allDocs.reduce((sum, d) => sum + d.sizeBytes, 0),
  };

  function handleFile(file: File) {
    const category = categorizeFromFilename(file.name);
    uploadDocument({
      patientId: patient!.id,
      name: file.name,
      category,
      sizeBytes: file.size,
      uploaderName: "Dr. Mehta",
    });
    toast.success("Document uploaded", { description: `${file.name} · scanned · clean · audit-logged` });
  }

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
        <span className="text-[var(--color-foreground)]">Documents</span>
      </div>

      <PageHeader
        eyebrow="Documents"
        title={`${patient.name} · Documents`}
        description="Lab reports, imaging, and discharge summaries. Uploads are scanned and signed download URLs are time-limited."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href={`/clinician/patients/${patient.id}`}>
                <Stethoscope /> Back to chart
              </Link>
            </Button>
            <Button size="sm" disabled={!canUpload} onClick={() => fileInputRef.current?.click()}>
              <Upload /> Upload document
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.dcm,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
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
        {activeGrant && <Badge variant="success" size="sm" dot>Temp. access granted</Badge>}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={FileImage} label="Total" value={String(stats.total)} />
        <Stat icon={Beaker} label="Lab reports" value={String(stats.lab)} tone="info" />
        <Stat icon={FileText} label="Imaging" value={String(stats.imaging)} tone="success" />
        <Stat icon={HardDrive} label="Storage" value={formatSize(stats.totalBytes)} />
      </div>

      {/* Body */}
      {!canView ? (
        <ConsentDeniedCard
          category="Documents"
          onRequestAccess={pending ? undefined : () => setRequestOpen(true)}
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Search documents by file name or uploader…"
              leadingIcon={<Search />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:max-w-md"
            />
            <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
              <TabsList>
                {CATEGORY_FILTERS.map((c) => (
                  <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* List */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center">
              <FileImage className="size-6 text-[var(--color-muted-foreground)]" />
              <p className="text-sm font-medium">
                {allDocs.length === 0 ? "No documents uploaded for this patient yet" : "No documents match the current filters"}
              </p>
              <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
                {allDocs.length === 0
                  ? "Upload lab reports, imaging, or discharge summaries. Files are virus-scanned before storage."
                  : "Try clearing search or switching category filters."}
              </p>
              {allDocs.length === 0 ? (
                <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload /> Upload first document
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setCategoryFilter("all");
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
                  {filtered.length} document{filtered.length === 1 ? "" : "s"}
                </p>
                <SecurityBadge variant="encrypted" />
              </div>
              <ul className="divide-y divide-[var(--color-border)]">
                {filtered.map((d) => (
                  <li key={d.id} className="flex items-start gap-4 p-5 hover:bg-[var(--color-muted)]/40">
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                      <FileImage className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{d.name}</p>
                        <Badge variant="muted" size="sm">{d.category}</Badge>
                        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-success)]">
                          <CheckCircle2 className="size-3" /> Scanned · clean
                        </span>
                      </div>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                        <Clock className="size-3" /> {dateTimeLabel(d.uploadedAt)}
                        <span>·</span> {formatSize(d.sizeBytes)}
                        <span>·</span> uploaded by {d.uploaderName}
                        <span>·</span> <span className="font-mono">{d.id}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          toast.success("Signed download URL generated", {
                            description: `${d.name} · valid for 5 minutes · audit-logged`,
                          })
                        }
                      >
                        Download
                      </Button>
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
          A sensitive-access request is already pending Sai&apos;s review for this patient.
          <Button
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => simulateApprovalDecision(pending.id, "approve", "Approved by Sai (demo simulation).")}
          >
            <ShieldCheck className="mr-1 size-3.5" /> (demo) Simulate approval
          </Button>
        </p>
      )}

      <RequestAccessDialog
        open={requestOpen}
        onOpenChange={setRequestOpen}
        patient={patient}
        initialScope="imaging"
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
  value: string;
  tone?: "success" | "info";
}) {
  const ring =
    tone === "success"
      ? "text-[var(--color-success)] bg-[var(--color-success-soft)]/50"
      : tone === "info"
        ? "text-[var(--color-info)] bg-[var(--color-info-soft)]/50"
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
