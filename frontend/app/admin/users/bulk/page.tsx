"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminStore, type StaffRole } from "@/lib/admin-store";

interface ParsedRow {
  rowIdx: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  department: string;
  errors: string[];
}

const VALID_ROLES: StaffRole[] = ["Clinician", "Org Admin", "Compliance Manager", "Auditor", "Care Team"];

function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Skip header if present
  const start = /first.*name/i.test(lines[0]) ? 1 : 0;
  const out: ParsedRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim());
    const row: ParsedRow = {
      rowIdx: i + 1,
      firstName: parts[0] ?? "",
      lastName: parts[1] ?? "",
      email: parts[2] ?? "",
      role: parts[3] ?? "",
      department: parts[4] ?? "",
      errors: [],
    };
    if (!row.firstName) row.errors.push("Missing first name");
    if (!row.lastName) row.errors.push("Missing last name");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) row.errors.push("Invalid email");
    if (!VALID_ROLES.includes(row.role as StaffRole)) row.errors.push(`Unknown role · expected one of ${VALID_ROLES.join(", ")}`);
    out.push(row);
  }
  return out;
}

const TEMPLATE = "First name,Last name,Email,Role,Department\nAisha,Khan,aisha.khan@citygeneral.health,Clinician,Cardiology\nRavi,Mehta,ravi.mehta@citygeneral.health,Care Team,General Medicine\n";

export default function BulkStaffPage() {
  const router = useRouter();
  const { addStaff, markOnboardingStep } = useAdminStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "staff-invite-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    const text = await f.text();
    setRows(parseCsv(text));
    e.target.value = "";
  }

  function sendAll() {
    const valid = rows.filter((r) => r.errors.length === 0);
    if (valid.length === 0) {
      toast.warning("No valid rows to send");
      return;
    }
    setSubmitting(true);
    valid.forEach((r) =>
      addStaff({
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        role: r.role as StaffRole,
        department: r.department || undefined,
      }),
    );
    markOnboardingStep("firstStaffInvited", true);
    toast.success(`${valid.length} invitation${valid.length === 1 ? "" : "s"} queued`, {
      description: "SendGrid throttled to 100/min · status visible in user list",
    });
    setTimeout(() => {
      setSubmitting(false);
      router.push("/admin/users");
    }, 400);
  }

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  return (
    <>
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Link href="/admin/users" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
          <ArrowLeft className="size-3.5" /> Staff
        </Link>
        <span>/</span>
        <span>Bulk import</span>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bulk staff import</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Upload a CSV with columns: <code className="font-mono text-xs">First name, Last name, Email, Role, Department</code>.
            Each row creates an invitation (7-day expiry, single-use).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download /> Download template
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <div
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-50)]/30"
          >
            <input ref={inputRef} type="file" accept=".csv" hidden onChange={onFile} />
            <Upload className="mx-auto size-7 text-[var(--color-primary-700)]" />
            <p className="mt-3 text-base font-semibold">
              {filename || "Click to upload a CSV"}
            </p>
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              .csv up to 500 rows · header row optional · throttled to 100 emails / minute
            </p>
          </div>

          {rows.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
                <p className="text-sm font-semibold">Preview · {rows.length} row{rows.length === 1 ? "" : "s"}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="success" size="sm" dot>{validCount} valid</Badge>
                  {errorCount > 0 && <Badge variant="danger" size="sm" dot>{errorCount} errors</Badge>}
                </div>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full min-w-[720px] text-xs">
                  <thead className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Dept</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {rows.map((r) => (
                      <tr key={r.rowIdx} className={r.errors.length > 0 ? "bg-[var(--color-danger-soft)]/30" : ""}>
                        <td className="px-3 py-2 font-mono text-[10px]">{r.rowIdx}</td>
                        <td className="px-3 py-2 font-medium">{r.firstName} {r.lastName}</td>
                        <td className="px-3 py-2">{r.email}</td>
                        <td className="px-3 py-2">{r.role}</td>
                        <td className="px-3 py-2 text-[var(--color-muted-foreground)]">{r.department || "—"}</td>
                        <td className="px-3 py-2">
                          {r.errors.length === 0 ? (
                            <Badge variant="success" size="sm" dot>OK</Badge>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[var(--color-danger)]" title={r.errors.join("; ")}>
                              <AlertCircle className="size-3" /> {r.errors[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Ready to send</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{validCount}</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {errorCount > 0 ? `${errorCount} row${errorCount === 1 ? "" : "s"} skipped due to errors` : "All rows valid"}
            </p>
            <Button className="mt-4 w-full" onClick={sendAll} disabled={validCount === 0 || submitting}>
              {submitting ? <><Loader2 className="animate-spin" /> Queuing…</> : <><Send /> Send {validCount} invitation{validCount === 1 ? "" : "s"}</>}
            </Button>
            <Button asChild variant="outline" className="mt-2 w-full">
              <Link href="/admin/users">Cancel</Link>
            </Button>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">CSV format</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-[var(--color-muted)]/40 p-2 font-mono text-[10px] leading-relaxed text-[var(--color-muted-foreground)]">
{`First name,Last name,Email,Role,Department
Aisha,Khan,aisha.khan@…,Clinician,Cardiology
Ravi,Mehta,ravi.mehta@…,Care Team,General Medicine`}
            </pre>
            <p className="mt-3 inline-flex items-center gap-1.5 text-[var(--color-muted-foreground)]">
              <CheckCircle2 className="size-3 text-[var(--color-success)]" /> Each row = one invitation token
            </p>
          </div>
        </div>
      </div>

      <p className="sr-only">{FileText.displayName}</p>
    </>
  );
}
