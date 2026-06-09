"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Download,
  ArrowRight,
  ShieldCheck,
  Filter,
  Calendar,
  Receipt,
  Building2,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

interface Subscription {
  tierName: string; cycle: string; qty: number; status: string;
  amountCents: number; currency: string; cardBrand: string | null; cardLast4: string | null;
  nextBilling: string | null;
}
interface Invoice {
  number: string; tierName: string; cycle: string; amountCents: number; currency: string;
  status: string; cardBrand: string | null; cardLast4: string | null; transactionId: string;
  billingName: string | null; billingEmail: string | null;
  periodStart: string | null; periodEnd: string | null; createdAt: string;
}

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

type StatusFilter = "all" | "paid" | "pending" | "failed";

export default function AdminBillingPage() {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingEmail, setBillingEmail] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/billing", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.ok) return;
        setSubscription(j.subscription ?? null);
        setInvoices(Array.isArray(j.invoices) ? j.invoices : []);
        setBillingEmail(j.billingEmail ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(
    () => invoices.filter((inv) => {
      if (statusFilter !== "all" && inv.status !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (q && !inv.number.toLowerCase().includes(q) && !inv.tierName.toLowerCase().includes(q)) return false;
      return true;
    }),
    [invoices, statusFilter, search],
  );
  const lifetime = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amountCents, 0);

  function downloadInvoice(inv: Invoice) {
    renderInvoicePdf({ ...inv, status: inv.status, createdAt: inv.createdAt });
  }

  return (
    <>
      <PageHeader
        eyebrow="Billing"
        title="Subscription & invoices"
        description="Manage your plan, payment method, and download every invoice for your tenant."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/pricing">Change plan <ArrowRight /></Link>
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading billing…
        </div>
      ) : !subscription ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center">
          <Building2 className="size-7 text-[var(--color-muted-foreground)]" />
          <p className="text-sm font-semibold">No active subscription yet</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            Pick a plan to activate your tenant. Your invoices and payment history will appear here after the first payment.
          </p>
          <Button asChild className="mt-1"><Link href="/pricing">View plans <ArrowRight /></Link></Button>
        </div>
      ) : (
        <>
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
                      <h2 className="text-lg font-semibold">{subscription.tierName} · {subscription.cycle === "annual" ? "annual" : "monthly"}</h2>
                      <Badge variant={subscription.status === "active" ? "success" : "warning"} size="sm" dot>
                        {subscription.status === "active" ? "Active" : subscription.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {subscription.qty.toLocaleString()} units · last charge {money(subscription.amountCents, subscription.currency)}
                    </p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/pricing">Upgrade or downgrade</Link>
                </Button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <Stat icon={Calendar} label="Next invoice" value={fmtDate(subscription.nextBilling)} sub="Auto-renews" />
                <Stat icon={Receipt} label="Last billed" value={money(subscription.amountCents, subscription.currency)} sub={fmtDate(invoices[0]?.createdAt)} />
                <Stat icon={ShieldCheck} label="Lifetime spend" value={money(lifetime, subscription.currency)} sub={`Across ${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`} />
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                  <CreditCard className="size-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold">Payment method</h3>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {subscription.cardBrand ? `${subscription.cardBrand.toUpperCase()} · ending in ${subscription.cardLast4 ?? "----"}` : "Card on file"}
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
                    Billing email <span className="font-mono">{billingEmail ?? "—"}</span>
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <Button asChild variant="outline" size="sm"><Link href="/pricing"><CreditCard /> Update plan / card</Link></Button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              placeholder="Search invoice # or plan…"
              leadingIcon={<Filter />}
              className="sm:flex-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <TabsList>
              <TabsTrigger value="all">All · {invoices.length}</TabsTrigger>
              <TabsTrigger value="paid">Paid · {invoices.filter((i) => i.status === "paid").length}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    <th className="px-5 py-3">Invoice #</th>
                    <th className="px-5 py-3">Period</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Transaction</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">No invoices match the current filters.</td></tr>
                  )}
                  {filtered.map((inv) => (
                    <tr key={inv.number} className="align-top">
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-xs font-semibold">{inv.number}</p>
                        <p className="text-[11px] text-[var(--color-muted-foreground)]">{fmtDate(inv.createdAt)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--color-muted-foreground)]">
                        {fmtDate(inv.periodStart)}<br />{fmtDate(inv.periodEnd)}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm">{inv.tierName} · {inv.cycle === "annual" ? "Annual" : "Monthly"}</p>
                        <p className="text-[11px] text-[var(--color-muted-foreground)]">{inv.cardBrand ? `${inv.cardBrand.toUpperCase()} ···· ${inv.cardLast4 ?? "----"}` : ""}</p>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-[var(--color-muted-foreground)]">{inv.transactionId.slice(-16) || "—"}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums">{money(inv.amountCents, inv.currency)}</td>
                      <td className="px-5 py-3.5 text-center">
                        {inv.status === "paid"
                          ? <Badge variant="success" size="sm" dot>Paid</Badge>
                          : <Badge variant="info" size="sm" dot>{inv.status}</Badge>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button size="sm" variant="ghost" onClick={() => downloadInvoice(inv)}>
                          <Download /> PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

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
