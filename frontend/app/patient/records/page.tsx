"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Download,
  Beaker,
  Pill,
  FileImage,
  ClipboardList,
  FileText,
  Calendar,
  Stethoscope,
  ChevronRight,
  Lock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SecurityBadge } from "@/components/shared/security-badge";
import { PageHeader } from "@/components/shared/page-header";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RECORDS, type Category } from "./records-data";

const LAB = "from-[oklch(0.65_0.13_195)] to-[oklch(0.5_0.12_205)]";
const RX = "from-[oklch(0.7_0.13_320)] to-[oklch(0.55_0.13_330)]";
const IMG = "from-[oklch(0.62_0.14_235)] to-[oklch(0.48_0.13_245)]";
const NOTE = "from-[oklch(0.72_0.14_75)] to-[oklch(0.58_0.13_55)]";
const DIS = "from-[oklch(0.68_0.14_158)] to-[oklch(0.52_0.12_160)]";

const META: Record<Category, { icon: typeof Beaker; accent: string }> = {
  "Lab Report": { icon: Beaker, accent: LAB },
  Prescription: { icon: Pill, accent: RX },
  Imaging: { icon: FileImage, accent: IMG },
  "Clinical Note": { icon: FileText, accent: NOTE },
  Discharge: { icon: ClipboardList, accent: DIS },
};

const CATEGORIES: { key: "all" | Category; name: string; icon: typeof Beaker }[] = [
  { key: "all", name: "All records", icon: FileText },
  { key: "Lab Report", name: "Lab Reports", icon: Beaker },
  { key: "Prescription", name: "Prescriptions", icon: Pill },
  { key: "Imaging", name: "Imaging", icon: FileImage },
  { key: "Clinical Note", name: "Clinical Notes", icon: FileText },
  { key: "Discharge", name: "Discharge", icon: ClipboardList },
];

const CLINICIANS = ["Dr. Priya Shah", "Dr. Rohan Iyer", "Dr. Neha Kapoor", "Radiology Dept."];

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "12m", label: "Last 12 months", days: 365 },
  { key: "all", label: "All time", days: null },
];

const PAGE_SIZE = 6;
const TODAY = new Date("2026-05-21");

const CATEGORY_KEYS: Category[] = ["Lab Report", "Prescription", "Imaging", "Clinical Note", "Discharge"];

export default function RecordsPage() {
  const searchParams = useSearchParams();
  const initialCategory: "all" | Category = (() => {
    const c = searchParams.get("category");
    return c && (CATEGORY_KEYS as string[]).includes(c) ? (c as Category) : "all";
  })();
  const [category, setCategory] = useState<"all" | Category>(initialCategory);
  const [range, setRange] = useState("12m");
  const [clinicians, setClinicians] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [finalizedOnly, setFinalizedOnly] = useState(false);
  const [page, setPage] = useState(0);

  // Re-filter whenever any control changes; reset to the first page.
  const filtered = useMemo(() => {
    const rangeDays = RANGES.find((r) => r.key === range)?.days ?? null;
    const q = search.trim().toLowerCase();
    return RECORDS.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (clinicians.length > 0 && !clinicians.includes(r.clinician)) return false;
      if (finalizedOnly && r.status !== "Finalized") return false;
      if (rangeDays !== null) {
        const ageDays = (TODAY.getTime() - new Date(r.date).getTime()) / 86_400_000;
        if (ageDays > rangeDays) return false;
      }
      if (q && !`${r.title} ${r.clinician} ${r.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [category, range, clinicians, search, finalizedOnly]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRecords = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(0);
    };
  }

  function toggleClinician(name: string) {
    setPage(0);
    setClinicians((cs) => (cs.includes(name) ? cs.filter((c) => c !== name) : [...cs, name]));
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("HealthSecure Portal — Clinical history", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(`Exported ${TODAY.toDateString()} · ${RECORDS.length} records · HIPAA right-of-access`, 14, 27);
    doc.setTextColor(20);
    let y = 40;
    RECORDS.forEach((r, i) => {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(11);
      doc.text(`${i + 1}. ${r.title}`, 14, y);
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(`${r.category} · ${r.clinician} · ${r.date} · ${r.id} · ${r.status}`, 14, y + 5);
      doc.setTextColor(20);
      y += 13;
    });
    doc.save("healthsecure-clinical-history.pdf");
    toast.success("Clinical history exported", { description: `${RECORDS.length} records · PDF downloaded` });
  }

  const allFiltersOn = category !== "all" || range !== "12m" || clinicians.length > 0 || search || finalizedOnly;

  return (
    <>
      <PageHeader
        eyebrow="Medical Records"
        title="Your clinical history"
        description="Read-only access to records authored by your care team. Finalized notes are immutable and every view is audit-logged."
        actions={
          <>
            <SecurityBadge variant="encrypted" />
            <SecurityBadge variant="audited" />
            <Button variant="outline" size="sm" onClick={exportPdf}>
              <Download /> Export all (PDF)
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* Sidebar filter */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Categories
            </p>
            <ul className="space-y-1">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const count =
                  c.key === "all"
                    ? RECORDS.length
                    : RECORDS.filter((r) => r.category === c.key).length;
                const active = category === c.key;
                return (
                  <li key={c.key}>
                    <button
                      onClick={() => resetPage(setCategory)(c.key)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? "bg-[var(--color-primary-50)] font-medium text-[var(--color-primary-700)]"
                          : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex-1 text-left">{c.name}</span>
                      <span className="tabular-nums text-[11px] text-[var(--color-muted-foreground)]">{count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Date range
            </p>
            <div className="space-y-2 text-sm">
              {RANGES.map((r) => (
                <label
                  key={r.key}
                  className="flex cursor-pointer items-center gap-2.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                >
                  <input
                    type="radio"
                    name="range"
                    checked={range === r.key}
                    onChange={() => resetPage(setRange)(r.key)}
                    className="size-3.5 text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Clinician
            </p>
            <div className="space-y-2 text-sm">
              {CLINICIANS.map((c) => (
                <label
                  key={c}
                  className="flex cursor-pointer items-center gap-2.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                >
                  <input
                    type="checkbox"
                    checked={clinicians.includes(c)}
                    onChange={() => toggleClinician(c)}
                    className="size-3.5 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)]/30"
                  />
                  {c}
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* List */}
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Search records by title, clinician, MRN…"
              leadingIcon={<Search />}
              className="sm:flex-1"
              value={search}
              onChange={(e) => resetPage(setSearch)(e.target.value)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="default" className="sm:w-auto">
                  <Filter /> More filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>More filters</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => { setFinalizedOnly((v) => !v); setPage(0); }}>
                  {finalizedOnly ? "✓ " : ""}Finalized only
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setCategory("all");
                    setRange("12m");
                    setClinicians([]);
                    setSearch("");
                    setFinalizedOnly(false);
                    setPage(0);
                  }}
                >
                  Clear all filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3 text-xs text-[var(--color-muted-foreground)]">
              <span>
                Showing <span className="font-medium text-[var(--color-foreground)]">{filtered.length}</span> of{" "}
                {RECORDS.length} records
                {allFiltersOn && <span> · filtered</span>}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5" /> Sorted by most recent
              </span>
            </div>

            {pageRecords.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-[var(--color-muted-foreground)]">
                No records match the current filters.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {pageRecords.map((r) => {
                  const meta = META[r.category];
                  const Icon = meta.icon;
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/patient/records/${r.id}`}
                        className="group flex items-center gap-4 p-5 transition-colors hover:bg-[var(--color-muted)]/40"
                      >
                        <span className={`flex size-11 items-center justify-center rounded-xl bg-gradient-to-br ${meta.accent} text-white shadow-[var(--shadow-soft)]`}>
                          <Icon className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold">{r.title}</p>
                            <Badge variant="muted" size="sm">{r.category}</Badge>
                            {r.status === "Finalized" ? (
                              <Badge variant="success" size="sm" dot>Finalized</Badge>
                            ) : (
                              <Badge variant="info" size="sm" dot>Active</Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-muted-foreground)]">
                            <span className="inline-flex items-center gap-1"><Stethoscope className="size-3.5" />{r.clinician}</span>
                            <span className="inline-flex items-center gap-1"><Calendar className="size-3.5" />{r.date}</span>
                            <span className="font-mono">{r.id}</span>
                          </div>
                        </div>
                        <SecurityBadge variant="encrypted" className="hidden md:inline-flex" />
                        <ChevronRight className="size-4 text-[var(--color-muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-muted-foreground)]">
              {filtered.length === 0
                ? "0 results"
                : `${safePage * PAGE_SIZE + 1} – ${Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}`}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Previous
              </Button>
              <span className="px-2 text-[var(--color-muted-foreground)]">
                {safePage + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
