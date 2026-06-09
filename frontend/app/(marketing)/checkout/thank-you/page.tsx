import Link from "next/link";
import { CheckCircle2, ArrowRight, Mail, ShieldCheck, Receipt, CreditCard, Calendar, Hash, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStripe } from "@/lib/stripe";
import { finalizePayment, type InvoiceView } from "@/lib/billing";
import { DownloadInvoiceButton } from "./download-invoice-button";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export const metadata = { title: "Order confirmed" };
export const dynamic = "force-dynamic";

function money(amount: number | null | undefined, currency: string | null | undefined): string | null {
  if (typeof amount !== "number") return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: (currency ?? "usd").toUpperCase() }).format(amount / 100);
}

/** Hosted Checkout fallback (session_id) → minimal invoice view. */
async function fromSession(sessionId: string): Promise<{ paid: boolean; invoice: InvoiceView | null }> {
  const stripe = getStripe();
  if (!stripe) return { paid: false, invoice: null };
  try {
    const s = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      paid: s.payment_status === "paid",
      invoice: {
        number: null,
        tierName: (s.metadata?.tierName as string) ?? "Subscription",
        cycle: (s.metadata?.cycle as string) ?? "annual",
        qty: Number(s.metadata?.qty ?? 1),
        amountCents: s.amount_total ?? 0,
        currency: s.currency ?? "usd",
        cardBrand: null,
        cardLast4: null,
        transactionId: s.id,
        billingName: s.customer_details?.name ?? null,
        billingEmail: s.customer_details?.email ?? s.customer_email ?? null,
        periodStart: null,
        periodEnd: null,
      },
    };
  } catch {
    return { paid: false, invoice: null };
  }
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; payment_intent?: string }>;
}) {
  const { session_id, payment_intent } = await searchParams;

  // Embedded flow: re-verify + persist the subscription/invoice + activate the
  // tenant (idempotent). Hosted flow: read the session.
  let paid = false;
  let invoice: InvoiceView | null = null;
  if (payment_intent) {
    const fin = await finalizePayment(payment_intent);
    paid = fin.paid;
    invoice = fin.invoice;
  } else if (session_id) {
    const r = await fromSession(session_id);
    paid = r.paid;
    invoice = r.invoice;
  }
  const ref = invoice?.transactionId ?? payment_intent ?? session_id;

  return (
    <section className="relative overflow-hidden">
      {/* Decorative glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 size-[440px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[oklch(0.85_0.12_158)] to-transparent opacity-40 blur-3xl" />
        <div className="absolute top-44 -right-24 size-72 rounded-full bg-gradient-to-br from-[oklch(0.82_0.12_200)] to-transparent opacity-30 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-xl px-4 py-16 text-center sm:px-6 sm:py-20">
        {/* Success badge */}
        <span className="relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-success)] to-[oklch(0.5_0.13_160)] text-white shadow-[var(--shadow-lift)]">
          <CheckCircle2 className="size-8" />
          <span aria-hidden className="absolute inset-0 -z-10 rounded-2xl bg-[var(--color-success)] opacity-30 blur-xl" />
        </span>

        {paid && (
          <div className="mt-4 flex justify-center">
            <Badge variant="success" size="sm" dot>Subscription active</Badge>
          </div>
        )}

        <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Thank you — your order is confirmed</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--color-muted-foreground)]">
          {paid
            ? "Payment received and your subscription is active. A receipt is on its way to your inbox."
            : "Your checkout is complete. We'll email your receipt shortly."}
        </p>

        {/* Invoice card */}
        <div className="mx-auto mt-8 overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] text-left shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-muted)]/30 px-5 py-3">
            <div className="inline-flex items-center gap-2">
              <Receipt className="size-4 text-[var(--color-primary-700)]" />
              <span className="text-sm font-semibold">Invoice</span>
              {invoice?.number && <span className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{invoice.number}</span>}
            </div>
            <Badge variant={paid ? "success" : "info"} size="sm" dot>{paid ? "Paid" : "Processing"}</Badge>
          </div>

          {/* Amount hero */}
          <div className="border-b border-[var(--color-border)] px-5 py-6 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">Amount paid</p>
            <p className="mt-1 bg-gradient-to-br from-[var(--color-foreground)] to-[var(--color-muted-foreground)] bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
              {invoice ? money(invoice.amountCents, invoice.currency) : "—"}
            </p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {invoice ? `${invoice.tierName} · ${invoice.cycle === "annual" ? "Annual" : "Monthly"}` : "Subscription"}
            </p>
          </div>

          {/* Detail rows */}
          <dl className="space-y-3 px-5 py-4 text-sm">
            {invoice?.cardBrand && <Row icon={CreditCard} label="Payment method" value={`${invoice.cardBrand.toUpperCase()} ···· ${invoice.cardLast4 ?? "----"}`} />}
            {invoice?.periodEnd && <Row icon={Calendar} label="Next billing" value={fmtDate(invoice.periodEnd)} />}
            {invoice?.billingEmail && <Row icon={Mail} label="Receipt sent to" value={invoice.billingEmail} />}
            {ref && <Row icon={Hash} label="Transaction ID" value={ref.slice(-20)} mono />}
          </dl>

          <div className="flex items-center gap-1.5 border-t border-[var(--color-border)] bg-[var(--color-muted)]/20 px-5 py-2.5 text-[11px] text-[var(--color-muted-foreground)]">
            <ShieldCheck className="size-3.5 shrink-0 text-[var(--color-primary-700)]" /> Payment processed securely by Stripe · audit-logged
          </div>
        </div>

        {/* Actions */}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/admin/dashboard">Go to dashboard <ArrowRight /></Link>
          </Button>
          {invoice && (
            <DownloadInvoiceButton invoice={{ ...invoice, status: "paid", createdAt: invoice.periodStart }} />
          )}
          <Button asChild variant="outline" size="lg">
            <Link href="/admin/billing">View billing</Link>
          </Button>
        </div>

        {/* What's next */}
        <div className="mx-auto mt-10 grid max-w-lg gap-3 text-left sm:grid-cols-3">
          <NextStep icon={ShieldCheck} title="Subscription active" desc="Your tenant is upgraded and ready." />
          <NextStep icon={Mail} title="Receipt emailed" desc="A copy is on the way to your inbox." />
          <NextStep icon={Sparkles} title="Start using it" desc="Invite your team from the dashboard." />
        </div>
      </div>
    </section>
  );
}

function Row({ icon: Icon, label, value, mono }: { icon?: LucideIcon; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="inline-flex items-center gap-1.5 text-[var(--color-muted-foreground)]">
        {Icon && <Icon className="size-3.5" />} {label}
      </dt>
      <dd className={`font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function NextStep({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)]/70 p-3">
      <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
        <Icon className="size-4" />
      </span>
      <p className="mt-2 text-xs font-semibold">{title}</p>
      <p className="text-[11px] text-[var(--color-muted-foreground)]">{desc}</p>
    </div>
  );
}
