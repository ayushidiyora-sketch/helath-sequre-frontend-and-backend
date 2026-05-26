"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Filter,
  Calendar,
  Receipt,
  Building2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ActionButton } from "@/components/shared/action-button";

type InvoiceStatus = "paid" | "pending" | "failed";

interface Invoice {
  id: string;
  number: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  status: InvoiceStatus;
  plan: string;
  description: string;
}

const INVOICES: Invoice[] = [
  {
    id: "inv-2026-05",
    number: "INV-2026-0512",
    date: "May 1, 2026",
    periodStart: "May 1, 2026",
    periodEnd: "May 31, 2026",
    amount: 3290.0,
    status: "paid",
    plan: "Hospital · annual",
    description: "470 active patient records × $6/mo + GST",
  },
  {
    id: "inv-2026-04",
    number: "INV-2026-0411",
    date: "Apr 1, 2026",
    periodStart: "Apr 1, 2026",
    periodEnd: "Apr 30, 2026",
    amount: 3094.0,
    status: "paid",
    plan: "Hospital · annual",
    description: "442 active patient records × $6/mo + GST",
  },
  {
    id: "inv-2026-03",
    number: "INV-2026-0310",
    date: "Mar 1, 2026",
    periodStart: "Mar 1, 2026",
    periodEnd: "Mar 31, 2026",
    amount: 2940.0,
    status: "paid",
    plan: "Hospital · annual",
    description: "420 active patient records × $6/mo + GST",
  },
  {
    id: "inv-2026-02",
    number: "INV-2026-0209",
    date: "Feb 1, 2026",
    periodStart: "Feb 1, 2026",
    periodEnd: "Feb 28, 2026",
    amount: 2786.0,
    status: "failed",
    plan: "Hospital · annual",
    description: "398 active patient records × $6/mo + GST · card declined",
  },
  {
    id: "inv-2026-02-rerun",
    number: "INV-2026-0209R",
    date: "Feb 3, 2026",
    periodStart: "Feb 1, 2026",
    periodEnd: "Feb 28, 2026",
    amount: 2786.0,
    status: "paid",
    plan: "Hospital · annual",
    description: "Re-attempt · Feb 2026",
  },
  {
    id: "inv-2026-01",
    number: "INV-2026-0108",
    date: "Jan 1, 2026",
    periodStart: "Jan 1, 2026",
    periodEnd: "Jan 31, 2026",
    amount: 2660.0,
    status: "paid",
    plan: "Hospital · annual",
    description: "380 active patient records × $6/mo + GST",
  },
  {
    id: "inv-2025-12",
    number: "INV-2025-1207",
    date: "Dec 1, 2025",
    periodStart: "Dec 1, 2025",
    periodEnd: "Dec 31, 2025",
    amount: 2611.0,
    status: "paid",
    plan: "Hospital · annual",
    description: "373 active patient records × $6/mo + GST",
  },
  {
    id: "inv-upcoming",
    number: "INV-2026-0613",
    date: "Jun 1, 2026",
    periodStart: "Jun 1, 2026",
    periodEnd: "Jun 30, 2026",
    amount: 3382.0,
    status: "pending",
    plan: "Hospital · annual",
    description: "483 active patient records × $6/mo + GST · scheduled",
  },
];

const formatINR = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

type StatusFilter = "all" | InvoiceStatus;

export default function AdminBillingPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [yearFilter, setYearFilter] = useState<string>("All");
  const [search, setSearch] = useState("");

  const years = useMemo(() => {
    const set = new Set(INVOICES.map((i) => i.date.split(", ")[1]));
    return ["All", ...Array.from(set).sort((a, b) => Number(b) - Number(a))];
  }, []);

  const filtered = INVOICES.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (yearFilter !== "All" && !inv.date.endsWith(yearFilter)) return false;
    const q = search.trim().toLowerCase();
    if (q && !inv.number.toLowerCase().includes(q) && !inv.description.toLowerCase().includes(q)) return false;
    return true;
  });

  const lifetime = INVOICES.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const failedCount = INVOICES.filter((i) => i.status === "failed").length;

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Subscription & invoices"
        description="Manage your plan, payment method, and download every invoice for your tenant."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/pricing">
              Change plan <ArrowRight />
            </Link>
          </Button>
        }
      />

      {/* Subscription + Payment method */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-[var(--color-primary)]/30 bg-gradient-to-br from-[var(--color-card)] via-[var(--color-card)] to-[var(--color-primary-50)]/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-sm">
                <Building2 className="size-5" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">Hospital · annual</h2>
                  <Badge variant="success" size="sm" dot>Active</Badge>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Billed monthly at $6 per active patient record · audit retention 6 years · SSO enabled
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/pricing">Upgrade or downgrade</Link>
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Stat icon={Calendar} label="Next invoice" value="Jun 1, 2026" sub="In 6 days" />
            <Stat icon={Receipt} label="Last billed" value={formatINR.format(3290)} sub="May 1, 2026" />
            <Stat icon={ShieldCheck} label="Lifetime spend" value={formatINR.format(lifetime)} sub="Across 6 invoices" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
              <CreditCard className="size-5" />
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold">Payment method</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">Visa · ending in 4242</p>
              <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
                Expires 12/27 · billing email <span className="font-mono">billing@cityhospital.com</span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton
              variant="outline"
              size="sm"
              toastMessage="Card update flow opened"
              toastDescription="Stripe-hosted secure form"
              toastVariant="info"
            >
              <CreditCard /> Update card
            </ActionButton>
            <ActionButton
              variant="ghost"
              size="sm"
              toastMessage="Receipt email updated"
              toastDescription="audit-logged"
              toastVariant="info"
            >
              Change billing email
            </ActionButton>
          </div>
        </div>
      </div>

      {/* Failed alert */}
      {failedCount > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)]/30 p-4">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]" />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-semibold">{failedCount} historical failed charge{failedCount === 1 ? "" : "s"}</p>
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              Each was re-attempted automatically within 48 hours. No action required — listed below for the audit trail.
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search invoice # or description…"
          leadingIcon={<Filter />}
          className="sm:flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="h-10 rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y === "All" ? "All years" : y}</option>
          ))}
        </select>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">All · {INVOICES.length}</TabsTrigger>
          <TabsTrigger value="paid">Paid · {INVOICES.filter((i) => i.status === "paid").length}</TabsTrigger>
          <TabsTrigger value="pending">Pending · {INVOICES.filter((i) => i.status === "pending").length}</TabsTrigger>
          <TabsTrigger value="failed">Failed · {INVOICES.filter((i) => i.status === "failed").length}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">
                    No invoices match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((inv) => (
                <tr key={inv.id} className="align-top">
                  <td className="px-5 py-3.5">
                    <p className="font-mono text-xs font-semibold">{inv.number}</p>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">{inv.date}</p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-[var(--color-muted-foreground)]">
                    {inv.periodStart}<br />{inv.periodEnd}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-sm">{inv.plan}</p>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">{inv.description}</p>
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums">
                    {formatINR.format(inv.amount)}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {inv.status === "paid" && <Badge variant="success" size="sm" dot>Paid</Badge>}
                    {inv.status === "pending" && <Badge variant="info" size="sm" dot>Pending</Badge>}
                    {inv.status === "failed" && <Badge variant="danger" size="sm" dot>Failed</Badge>}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {inv.status === "failed" && (
                        <ActionButton
                          size="sm"
                          variant="ghost"
                          toastMessage="Retrying charge"
                          toastDescription={`${inv.number} · stripe queued`}
                          toastVariant="info"
                        >
                          <RefreshCw /> Retry
                        </ActionButton>
                      )}
                      {inv.status === "pending" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted-foreground)]">
                          <Clock className="size-3" /> Scheduled
                        </span>
                      ) : (
                        <ActionButton
                          size="sm"
                          variant="ghost"
                          toastMessage="Invoice downloaded"
                          toastDescription={`${inv.number}.pdf`}
                          toastVariant="info"
                          onClick={() => toast.info(`Downloading ${inv.number}.pdf`)}
                        >
                          <Download /> PDF
                        </ActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center text-[11px] text-[var(--color-muted-foreground)]">
        Need a custom invoice or PO? Contact <Link href="/contact" className="text-[var(--color-primary-700)] underline-offset-2 hover:underline">billing support</Link>.
      </p>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <Icon className="size-3" /> {label}
      </div>
      <p className="mt-1 text-base font-semibold tracking-tight">{value}</p>
      <p className="text-[11px] text-[var(--color-muted-foreground)]">{sub}</p>
    </div>
  );
}
