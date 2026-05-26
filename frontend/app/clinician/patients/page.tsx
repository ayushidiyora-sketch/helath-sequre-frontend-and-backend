"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  Check,
  ChevronRight,
  Shield,
  Plus,
  Users,
  MessageSquare,
  Pill,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/shared/action-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useClinicianStore } from "@/lib/clinician-store";

type PatientStatus = "active" | "blocked";

export default function ClinicianPatientsPage() {
  const { state } = useClinicianStore();
  const [query, setQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<PatientStatus[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);

  function toggleStatus(s: PatientStatus) {
    setStatusFilters((curr) => (curr.includes(s) ? curr.filter((x) => x !== s) : [...curr, s]));
  }
  function clearFilters() {
    setStatusFilters([]);
  }

  const q = query.trim().toLowerCase();
  const filteredPatients = useMemo(() => {
    return state.assignedPatients
      .map((p) => {
        const lastAppt = state.appointments
          .filter((a) => a.patientId === p.id)
          .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))[0];
        const status: PatientStatus = p.consentStatus === "revoked" ? "blocked" : "active";
        return {
          ...p,
          status,
          lastLabel: lastAppt
            ? `${new Date(lastAppt.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${lastAppt.reason}`
            : "No visits yet",
        };
      })
      .filter((p) => {
        if (statusFilters.length > 0 && !statusFilters.includes(p.status)) return false;
        if (q && ![p.name, p.mrn, p.lastLabel].some((f) => f.toLowerCase().includes(q))) return false;
        return true;
      });
  }, [state.assignedPatients, state.appointments, statusFilters, q]);

  return (
    <>
      <PageHeader
        eyebrow="Patient panel"
        title="Your assigned patients"
        description="You can only see patients explicitly assigned to you. Access to each record category is gated by the patient's consent."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter /> Filters{statusFilters.length > 0 ? ` · ${statusFilters.length}` : ""}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("active"); }}>
                  {statusFilters.includes("active") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Active
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); toggleStatus("blocked"); }}>
                  {statusFilters.includes("blocked") ? <Check className="size-3.5" /> : <span className="size-3.5" />} Blocked
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={clearFilters}>Clear filters</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => setRequestOpen(true)}>
              <Plus /> Request assignment
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total assigned", value: 87, sub: "+4 this month", icon: Users },
          { label: "Active consents", value: 312, sub: "across 87 patients", icon: Shield },
          { label: "Open prescriptions", value: 53, sub: "23 active classes", icon: Pill },
          { label: "Unread threads", value: 4, sub: "1 urgent", icon: MessageSquare },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
                <Icon className="size-3.5" /> {s.label}
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{s.value}</p>
              <p className="text-[11px] text-[var(--color-muted-foreground)]">{s.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search by name, MRN, or chief complaint…"
          leadingIcon={<Search />}
          className="sm:flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ActionButton variant="outline" toastMessage="Sort options" toastVariant="info">
          Sort: Recently seen
        </ActionButton>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        {/* Header row — only on md+; below md we render cards. */}
        <div className="hidden md:grid grid-cols-12 gap-4 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          <div className="col-span-5">Patient</div>
          <div className="col-span-2">MRN</div>
          <div className="col-span-2">Age / Sex</div>
          <div className="col-span-2">Last contact</div>
          <div className="col-span-1 text-right">Access</div>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {filteredPatients.map((p) => (
            <li key={p.id}>
              <Link
                href={`/clinician/patients/${p.id}`}
                className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-[var(--color-muted)]/40 sm:px-5 md:grid md:grid-cols-12 md:items-center md:gap-4"
              >
                {/* Avatar + name — always visible */}
                <div className="flex min-w-0 items-center gap-3 md:col-span-5">
                  <Avatar className="size-10 shrink-0"><AvatarFallback>{p.initials}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      {p.status === "blocked" && <Badge variant="danger" size="sm" dot>Consent revoked</Badge>}
                    </div>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">{p.conditions?.[0] ?? "—"}</p>
                  </div>
                  {/* Chevron sits at the right of the card on mobile; moves into the Access column at md+. */}
                  <ChevronRight className="size-4 shrink-0 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5 md:hidden" />
                </div>

                {/* Stacked meta line on mobile (MRN · age · last contact). */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-muted-foreground)] md:hidden">
                  <span className="font-mono">{p.mrn}</span>
                  <span>·</span>
                  <span>{p.age} · {p.sex}</span>
                  <span>·</span>
                  <span className="truncate">{p.lastLabel}</span>
                </div>

                {/* Access badge — full-width on mobile, right-aligned on md+. */}
                <div className="flex items-center justify-between gap-1 md:hidden">
                  {p.consentScopes.length > 0 ? (
                    <Badge variant="success" size="sm" dot>{p.consentScopes.length} scopes</Badge>
                  ) : (
                    <Badge variant="danger" size="sm" dot>No access</Badge>
                  )}
                </div>

                {/* md+ table columns */}
                <div className="hidden md:block md:col-span-2 font-mono text-xs text-[var(--color-muted-foreground)]">{p.mrn}</div>
                <div className="hidden md:block md:col-span-2 text-xs">{p.age} · {p.sex}</div>
                <div className="hidden md:block md:col-span-2 text-xs text-[var(--color-muted-foreground)]">{p.lastLabel}</div>
                <div className="hidden md:flex md:col-span-1 items-center justify-end gap-1">
                  {p.consentScopes.length > 0 ? (
                    <Badge variant="success" size="sm" dot>{p.consentScopes.length} scopes</Badge>
                  ) : (
                    <Badge variant="danger" size="sm" dot>No access</Badge>
                  )}
                  <ChevronRight className="size-4 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            </li>
          ))}
          {filteredPatients.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
              {state.assignedPatients.length === 0
                ? "No patients are assigned to you yet."
                : query
                  ? `No patients match “${query}”.`
                  : "No patients match the current filters."}
            </li>
          )}
        </ul>
      </div>

      <RequestAssignmentDialog open={requestOpen} onOpenChange={setRequestOpen} />
    </>
  );
}

const JUSTIFICATIONS = [
  "Continuity of care",
  "Specialist consult",
  "Coverage for colleague",
  "Emergency / on-call",
] as const;

function RequestAssignmentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [mrn, setMrn] = useState("");
  const [reason, setReason] = useState("");
  const [justification, setJustification] = useState<string>(JUSTIFICATIONS[0]);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = mrn.trim().length > 0 && reason.trim().length >= 10 && !submitting;

  async function submit() {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 450));
    toast.success("Assignment request sent", {
      description: `MRN ${mrn.trim()} · ${justification} · audit-logged`,
    });
    setMrn("");
    setReason("");
    setJustification(JUSTIFICATIONS[0]);
    setSubmitting(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request patient assignment</DialogTitle>
          <DialogDescription>
            Org Admin will review and approve. All requests are recorded in
            the audit ledger with your justification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="req-mrn">Patient MRN</Label>
            <Input
              id="req-mrn"
              placeholder="CG-2026-0481"
              value={mrn}
              onChange={(e) => setMrn(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="req-justification">Justification</Label>
            <select
              id="req-justification"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
            >
              {JUSTIFICATIONS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="req-reason">Reason</Label>
            <Textarea
              id="req-reason"
              placeholder="Describe the clinical reason for needing access to this patient's chart…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
            <p className="text-[11px] text-[var(--color-muted-foreground)]">
              Minimum 10 characters · visible to Org Admin in the approval queue.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" /> Sending…
              </>
            ) : (
              "Send request"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
