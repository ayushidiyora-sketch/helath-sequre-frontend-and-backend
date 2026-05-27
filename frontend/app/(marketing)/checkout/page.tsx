"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Lock,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Building2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type TierId = "solo" | "hospital" | "enterprise";

interface Tier {
  id: TierId;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  tagline: string;
  monthly: number;
  annualMonthly: number;
  unitLabel: string;
  defaultQty: number;
  qtyLabel: string;
  qtyMin: number;
  qtyMax: number;
  trial: boolean;
  bullets: string[];
}

const TIERS: Record<TierId, Tier> = {
  solo: {
    id: "solo",
    name: "Solo Practice",
    icon: Stethoscope,
    tagline: "For independent clinicians and small clinics.",
    monthly: 149,
    annualMonthly: 124,
    unitLabel: "clinician",
    defaultQty: 1,
    qtyLabel: "Number of clinicians",
    qtyMin: 1,
    qtyMax: 5,
    trial: true,
    bullets: [
      "Up to 5 clinical users",
      "Unlimited patient accounts",
      "Encrypted records & consents",
      "Append-only audit (1-year retention)",
      "MFA + email OTP sign-in",
    ],
  },
  hospital: {
    id: "hospital",
    name: "Hospital",
    icon: Building2,
    tagline: "For multi-department hospitals.",
    monthly: 7,
    annualMonthly: 6,
    unitLabel: "active patient record",
    defaultQty: 500,
    qtyLabel: "Active patient records (estimate)",
    qtyMin: 100,
    qtyMax: 50_000,
    trial: false,
    bullets: [
      "Unlimited clinical users",
      "Compliance dashboard · anomaly engine",
      "Re-consent campaigns · approval workflows",
      "6-year audit ledger (HIPAA minimum)",
      "Break-glass · SSO (SAML/OIDC)",
      "Dedicated CSM · 4-hour SLA",
    ],
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    icon: ShieldCheck,
    tagline: "Custom — talk to us.",
    monthly: 0,
    annualMonthly: 0,
    unitLabel: "custom",
    defaultQty: 0,
    qtyLabel: "Custom",
    qtyMin: 0,
    qtyMax: 0,
    trial: false,
    bullets: [],
  },
};

const TAX_RATE = 0.09; // demo: 9%

export default function CheckoutPage() {
  return (
    <Suspense fallback={null}>
      <CheckoutPageInner />
    </Suspense>
  );
}

function CheckoutPageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const tierParam = (params.get("tier") || "solo") as TierId;
  const tier = TIERS[tierParam] ?? TIERS.solo;

  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");
  const [qty, setQty] = useState<number>(tier.defaultQty);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState("India");
  const [taxId, setTaxId] = useState("");

  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Memoize before any early return so hook order stays stable.
  const formatINR = useMemo(
    () => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }),
    [],
  );

  if (tier.id === "enterprise") {
    return <EnterpriseContact />;
  }

  const unitPrice = cycle === "annual" ? tier.annualMonthly : tier.monthly;
  const months = cycle === "annual" ? 12 : 1;
  const subtotal = unitPrice * qty * months;
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
  const total = subtotal + tax;

  const canSubmit =
    fullName.trim().length > 1 &&
    /\S+@\S+\.\S+/.test(email) &&
    orgName.trim().length > 1 &&
    cardName.trim().length > 1 &&
    cardNumber.replace(/\s/g, "").length >= 13 &&
    /^\d{2}\s*\/\s*\d{2}$/.test(cardExp) &&
    /^\d{3,4}$/.test(cardCvc);

  async function placeOrder() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    toast.success("Order placed", {
      description: `${tier.name} · ${cycle} · ${formatINR.format(total)} · receipt emailed to ${email}`,
    });
    setSubmitting(false);
    router.push("/admin/billing?status=success");
  }

  function startTrial() {
    toast.success("Trial started", {
      description: `${tier.name} · 14 days · no card charged · audit-logged`,
    });
    router.push("/register");
  }

  const TierIcon = tier.icon;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        <ArrowLeft className="size-3.5" /> Back to pricing
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">Checkout</h1>
      <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
        Confirm your plan and complete payment. Cancel anytime; data export window is 30 days post-cancel.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* LEFT — forms */}
        <div className="space-y-6">
          {/* Plan + cycle */}
          <Card>
            <SectionHeader icon={TierIcon} title={tier.name} subtitle={tier.tagline} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <CycleOption
                active={cycle === "monthly"}
                onClick={() => setCycle("monthly")}
                title="Monthly"
                sub={`${formatINR.format(tier.monthly)} per ${tier.unitLabel}`}
              />
              <CycleOption
                active={cycle === "annual"}
                onClick={() => setCycle("annual")}
                title="Annual"
                sub={`${formatINR.format(tier.annualMonthly)} per ${tier.unitLabel} · save 17%`}
                badge="Best value"
              />
            </div>
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="qty">{tier.qtyLabel}</Label>
              <Input
                id="qty"
                type="number"
                min={tier.qtyMin}
                max={tier.qtyMax}
                value={qty}
                onChange={(e) => setQty(Math.max(tier.qtyMin, Math.min(tier.qtyMax, Number(e.target.value) || tier.qtyMin)))}
              />
              <p className="text-[11px] text-[var(--color-muted-foreground)]">
                Range: {tier.qtyMin.toLocaleString()}–{tier.qtyMax.toLocaleString()}. Adjust later from billing settings.
              </p>
            </div>
          </Card>

          {/* Customer info */}
          <Card>
            <SectionHeader icon={ShieldCheck} title="Billing information" subtitle="Used for the invoice and tax filing." />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Full name" id="full-name" value={fullName} onChange={setFullName} placeholder="Anjali Desai" />
              <Field label="Billing email" id="email" value={email} onChange={setEmail} placeholder="billing@cityhospital.com" type="email" />
              <Field label="Organization" id="org-name" value={orgName} onChange={setOrgName} placeholder="City General Hospital" className="sm:col-span-2" />
              <div className="space-y-1.5">
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
                >
                  {["India", "United States", "United Kingdom", "Singapore", "United Arab Emirates", "Canada", "Australia"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <Field label="Tax ID (GST / VAT) — optional" id="tax-id" value={taxId} onChange={setTaxId} placeholder="24AAAAA0000A1Z5" />
            </div>
          </Card>

          {/* Payment */}
          <Card>
            <SectionHeader icon={CreditCard} title="Payment method" subtitle="Card · processed by Stripe (PCI-DSS Level 1)." />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Name on card" id="card-name" value={cardName} onChange={setCardName} placeholder="Anjali Desai" className="sm:col-span-2" />
              <Field
                label="Card number"
                id="card-number"
                value={cardNumber}
                onChange={(v) => setCardNumber(formatCardNumber(v))}
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                className="sm:col-span-2"
              />
              <Field label="Expiry · MM/YY" id="card-exp" value={cardExp} onChange={(v) => setCardExp(formatExp(v))} placeholder="12/27" inputMode="numeric" />
              <Field label="CVC" id="card-cvc" value={cardCvc} onChange={(v) => setCardCvc(v.replace(/\D/g, "").slice(0, 4))} placeholder="123" inputMode="numeric" />
            </div>
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
              <Lock className="size-3.5" /> Card data tokenized in your browser — never touches our servers.
            </p>
          </Card>
        </div>

        {/* RIGHT — order summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card>
            <SectionHeader icon={Sparkles} title="Order summary" subtitle={`${cycle === "annual" ? "Billed annually" : "Billed monthly"}`} />
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{tier.name}</p>
                  <p className="text-[11px] text-[var(--color-muted-foreground)]">
                    {qty.toLocaleString()} × {tier.unitLabel} × {months}mo
                  </p>
                </div>
                <p className="font-mono tabular-nums">{formatINR.format(subtotal)}</p>
              </li>
              <li className="flex items-center justify-between gap-3 text-[var(--color-muted-foreground)]">
                <span>Tax (GST/VAT, {Math.round(TAX_RATE * 100)}%)</span>
                <span className="font-mono tabular-nums">{formatINR.format(tax)}</span>
              </li>
            </ul>
            <div className="mt-4 flex items-baseline justify-between border-t border-[var(--color-border)] pt-4">
              <p className="text-sm font-medium">Total today</p>
              <p className="text-2xl font-semibold tracking-tight">{formatINR.format(total)}</p>
            </div>
            <p className="mt-1 text-[11px] text-[var(--color-muted-foreground)]">
              Renews automatically on{" "}
              <span className="font-medium text-[var(--color-foreground)]">
                {new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
              . Cancel anytime.
            </p>

            <Button
              className="mt-5 w-full"
              size="lg"
              onClick={placeOrder}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" /> Processing…
                </>
              ) : (
                <>
                  <Lock /> Place order · {formatINR.format(total)}
                </>
              )}
            </Button>

            {tier.trial && (
              <Button variant="outline" className="mt-2 w-full" onClick={startTrial} disabled={submitting}>
                Start 14-day free trial instead
              </Button>
            )}

            <ul className="mt-5 space-y-2 border-t border-[var(--color-border)] pt-4 text-xs">
              {tier.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[var(--color-primary-700)]" />
                  <span className="text-[var(--color-muted-foreground)]">{b}</span>
                </li>
              ))}
            </ul>
          </Card>

          <p className="mt-4 text-center text-[11px] text-[var(--color-muted-foreground)]">
            By placing the order you agree to the{" "}
            <Link href="/terms" className="underline-offset-2 hover:underline">Terms</Link> and{" "}
            <Link href="/privacy" className="underline-offset-2 hover:underline">Privacy Policy</Link>.
          </p>
        </aside>
      </div>
    </section>
  );
}

function EnterpriseContact() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
      <ShieldCheck className="mx-auto size-10 text-[var(--color-primary-700)]" />
      <h1 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Enterprise — let&apos;s talk</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
        Enterprise tier is priced per deployment shape — multi-tenant federation, BYOK / HSM, on-prem or
        sovereign-cloud, custom audit retention, named TAM. Tell us about your environment and we&apos;ll send
        a tailored quote.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild size="lg">
          <Link href="/contact">Contact sales <ArrowRight /></Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/pricing">Back to pricing</Link>
        </Button>
      </div>
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-6">{children}</div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-sm">
        <Icon className="size-5" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-[var(--color-muted-foreground)]">{subtitle}</p>
      </div>
    </div>
  );
}

function CycleOption({
  active,
  onClick,
  title,
  sub,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  sub: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition-colors ${
        active
          ? "border-[var(--color-primary)] bg-[var(--color-primary-50)]"
          : "border-[var(--color-border)] hover:bg-[var(--color-muted)]/40"
      }`}
    >
      {badge && (
        <span className="absolute right-2 top-2">
          <Badge variant="info" size="sm" dot>{badge}</Badge>
        </span>
      )}
      <p className={`text-sm font-semibold ${active ? "text-[var(--color-primary-700)]" : ""}`}>{title}</p>
      <p className="text-[11px] text-[var(--color-muted-foreground)]">{sub}</p>
    </button>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  className,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function formatCardNumber(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 19);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function formatExp(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
