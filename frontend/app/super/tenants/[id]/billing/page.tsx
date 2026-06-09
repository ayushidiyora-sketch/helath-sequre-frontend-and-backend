"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CreditCard, Calendar, Receipt, Download, Loader2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

interface Subscription {
  tierName: string; cycle: string; qty: number; status: string;
  amountCents: number; currency: string; cardBrand: string | null; cardLast4: string | null;
  periodStart: string | null; nextBilling: string | null;
}
interface Invoice {
  number: string; tierName: string; cycle: string; amountCents: number; currency: string;
  status: string; cardBrand: string | null; cardLast4: string | null; transactionId: string;
  billingName: string | null; billingEmail: string | null;
  periodStart: string | null; periodEnd: string | null; createdAt: string;
}
interface Data {
  tenant: { name: string; tier: string; status: string };
  subscription: Subscription | null;
  invoices: Invoice[];
}

const money = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function TenantBillingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/super/tenants/${id}/billing`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j?.ok ? (j as Data) : null); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, [id]);

  if (data === undefined) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="size-4 animate-spin" /> Loading billing…
      </div>
    );
  }
  if (!data) {
    return (
      <>
        <Back />
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center text-sm text-[var(--color-muted-foreground)]">
          Tenant not found.
        </div>
      </>
    );
  }

  const { tenant, subscription: sub, invoices } = data;
  const lifetime = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amountCents, 0);

  return (
    <>
      <Back />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary-700)]">Billing &amp; invoices</p>
        <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Building2 className="size-6 text-[var(--color-muted-foreground)]" /> {tenant.name}
        </h1>
      </div>

      {!sub ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center">
          <Receipt className="mx-auto size-7 text-[var(--color-muted-foreground)]" />
          <p className="mt-2 text-sm font-semibold">No subscription yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-[var(--color-muted-foreground)]">
            This tenant hasn&apos;t completed a payment. Tier: <span className="font-medium">{tenant.tier}</span> · status: <span className="font-medium">{tenant.status}</span>.
          </p>
        </div>
      ) : (
        <>
          {/* Subscription summary */}
          <div className="grid gap-4 sm:grid-cols-4">
            <Card label="Subscription plan" value={`${sub.tierName}`} sub={sub.cycle === "annual" ? "Annual" : "Monthly"} icon={Building2} />
            <Card
              label="Subscription status"
              value={sub.status === "active" ? "Active" : sub.status}
              sub={`Tenant: ${tenant.status}`}
              icon={ShieldCheck}
              badge={sub.status === "active"}
            />
            <Card label="Next billing date" value={fmtDate(sub.nextBilling)} sub="Auto-renews" icon={Calendar} />
            <Card
              label="Payment method"
              value={sub.cardBrand ? `${sub.cardBrand.toUpperCase()} ···· ${sub.cardLast4 ?? "----"}` : "Card on file"}
              sub={`Last charge ${money(sub.amountCents, sub.currency)}`}
              icon={CreditCard}
            />
          </div>

          {/* Invoice / payment history */}
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
              <div>
                <h2 className="text-sm font-semibold">Invoice &amp; payment history</h2>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{invoices.length} invoice{invoices.length === 1 ? "" : "s"} · lifetime {money(lifetime, sub.currency)}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    <th className="px-5 py-3">Invoice #</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Transaction ID</th>
                    <th className="px-5 py-3">Card</th>
                    <th className="px-5 py-3 text-right">Amount</th>
                    <th className="px-5 py-3 text-center">Status</th>
                    <th className="px-5 py-3 text-right">PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {invoices.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">No invoices.</td></tr>
                  )}
                  {invoices.map((inv) => (
                    <tr key={inv.number}>
                      <td className="px-5 py-3.5 font-mono text-xs font-semibold">{inv.number}</td>
                      <td className="px-5 py-3.5 text-xs text-[var(--color-muted-foreground)]">{fmtDate(inv.createdAt)}</td>
                      <td className="px-5 py-3.5 text-sm">{inv.tierName} · {inv.cycle === "annual" ? "Annual" : "Monthly"}</td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-[var(--color-muted-foreground)]">{inv.transactionId.slice(-18) || "—"}</td>
                      <td className="px-5 py-3.5 text-xs">{inv.cardBrand ? `${inv.cardBrand.toUpperCase()} ···· ${inv.cardLast4 ?? "----"}` : "—"}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums">{money(inv.amountCents, inv.currency)}</td>
                      <td className="px-5 py-3.5 text-center">
                        {inv.status === "paid" ? <Badge variant="success" size="sm" dot>Paid</Badge> : <Badge variant="info" size="sm" dot>{inv.status}</Badge>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button size="sm" variant="ghost" onClick={() => renderInvoicePdf({ ...inv, orgName: tenant.name, createdAt: inv.createdAt })}>
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
    </>
  );
}

function Back() {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
      <Link href="/super/tenants" className="inline-flex items-center gap-1.5 hover:text-[var(--color-foreground)]">
        <ArrowLeft className="size-3.5" /> Tenants
      </Link>
    </div>
  );
}

function Card({
  label, value, sub, icon: Icon, badge,
}: {
  label: string; value: string; sub: string; icon: React.ComponentType<{ className?: string }>; badge?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        <Icon className="size-3" /> {label}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <p className="text-base font-semibold tracking-tight">{value}</p>
        {badge && <Badge variant="success" size="sm" dot>Active</Badge>}
      </div>
      <p className="text-[11px] text-[var(--color-muted-foreground)]">{sub}</p>
    </div>
  );
}
