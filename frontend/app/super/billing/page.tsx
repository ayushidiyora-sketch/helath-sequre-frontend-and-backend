"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CreditCard, Receipt, Wallet, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";

interface TenantBilling {
  id: string;
  name: string;
  type: string;
  tier: string;
  status: string;
  subscription: {
    tierName: string; cycle: string | null; status: string | null;
    amountCents: number; cardBrand: string | null; cardLast4: string | null; nextBilling: string | null;
  } | null;
  invoiceCount: number;
  totalCents: number;
  lastPaymentAt: string | null;
  lastInvoiceNumber: string | null;
  lastAmountCents: number | null;
}
interface Data {
  summary: { tenants: number; activeSubscriptions: number; collectedCents: number };
  tenants: TenantBilling[];
}

const money = (cents: number | null | undefined) =>
  typeof cents === "number" ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100) : "—";
const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

export default function SuperBillingPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null | undefined>(undefined);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/super/billing", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setData(j?.ok ? (j as Data) : null); })
      .catch(() => { if (!cancelled) setData(null); });
    return () => { cancelled = true; };
  }, []);

  const tenants = (data?.tenants ?? []).filter((t) => {
    const q = search.trim().toLowerCase();
    return !q || t.name.toLowerCase().includes(q) || (t.subscription?.tierName ?? "").toLowerCase().includes(q);
  });

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Billing & payments"
        description="Subscription and payment details across every tenant. Click a tenant for its full invoice history."
      />

      {data === undefined ? (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-sm text-[var(--color-muted-foreground)]">
          <Loader2 className="size-4 animate-spin" /> Loading billing…
        </div>
      ) : !data ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
          Couldn&apos;t load billing.
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat icon={Building2} label="Tenants" value={String(data.summary.tenants)} />
            <Stat icon={CheckCircle2} label="Active subscriptions" value={String(data.summary.activeSubscriptions)} accent="success" />
            <Stat icon={Wallet} label="Total collected" value={money(data.summary.collectedCents)} accent="primary" />
          </div>

          <Input
            placeholder="Search tenant or plan…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />

          {/* Tenant-wise billing table */}
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    <th className="px-5 py-3">Tenant</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3 text-center">Subscription</th>
                    <th className="px-5 py-3">Card</th>
                    <th className="px-5 py-3">Last payment</th>
                    <th className="px-5 py-3">Next billing</th>
                    <th className="px-5 py-3 text-right">Total paid</th>
                    <th className="px-5 py-3 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {tenants.length === 0 && (
                    <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-[var(--color-muted-foreground)]">No tenants match.</td></tr>
                  )}
                  {tenants.map((t) => (
                    <tr
                      key={t.id}
                      className="cursor-pointer align-top hover:bg-[var(--color-muted)]/30"
                      onClick={() => router.push(`/super/tenants/${t.id}/billing`)}
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium">{t.name}</p>
                        <p className="text-[11px] capitalize text-[var(--color-muted-foreground)]">{t.type}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        {t.subscription ? (
                          <>
                            <p className="text-sm">{t.subscription.tierName}</p>
                            <p className="text-[11px] text-[var(--color-muted-foreground)]">{t.subscription.cycle === "annual" ? "Annual" : "Monthly"}</p>
                          </>
                        ) : (
                          <span className="text-xs text-[var(--color-muted-foreground)]">No plan · tier {t.tier}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        {t.subscription?.status === "active"
                          ? <Badge variant="success" size="sm" dot>Active</Badge>
                          : t.subscription
                            ? <Badge variant="warning" size="sm" dot>{t.subscription.status}</Badge>
                            : <Badge variant="muted" size="sm">None</Badge>}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {t.subscription?.cardBrand
                          ? <span className="inline-flex items-center gap-1.5"><CreditCard className="size-3.5 text-[var(--color-muted-foreground)]" /> {t.subscription.cardBrand.toUpperCase()} ···· {t.subscription.cardLast4 ?? "----"}</span>
                          : <span className="text-[var(--color-muted-foreground)]">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {t.lastPaymentAt ? (
                          <>
                            <p className="font-mono text-xs">{money(t.lastAmountCents)}</p>
                            <p className="text-[11px] text-[var(--color-muted-foreground)]">{fmtDate(t.lastPaymentAt)} · {t.lastInvoiceNumber}</p>
                          </>
                        ) : <span className="text-xs text-[var(--color-muted-foreground)]">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-[var(--color-muted-foreground)]">{fmtDate(t.subscription?.nextBilling)}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold tabular-nums">{money(t.totalCents)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); router.push(`/super/tenants/${t.id}/billing`); }}>
                          <Receipt /> Invoices <ArrowRight />
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

function Stat({
  icon: Icon, label, value, accent,
}: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: "success" | "primary";
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">{label}</p>
        <span className={`flex size-8 items-center justify-center rounded-lg ${
          accent === "success" ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
          : accent === "primary" ? "bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"
          : "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
