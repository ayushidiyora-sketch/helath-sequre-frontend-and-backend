import { Mail, Phone, MapPin, Clock, LifeBuoy, ShieldAlert, MessageSquare } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the HealthSecure Portal team — sales, onboarding, security, and support.",
};

const CHANNELS = [
  {
    icon: Mail,
    title: "Email us",
    lines: ["hello@healthsecure.example", "Replies within one business day"],
  },
  {
    icon: Phone,
    title: "Call us",
    lines: ["+1 (555) 0142-9000", "Mon–Fri · 9:00–18:00"],
  },
  {
    icon: MapPin,
    title: "Office",
    lines: ["Sensussoft Software Pvt Ltd", "Surat, Gujarat, India"],
  },
  {
    icon: Clock,
    title: "Support hours",
    lines: ["24/7 for production incidents", "Standard support on business days"],
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact us"
        icon={MessageSquare}
        image="/bg-contact.jpg"
        title={
          <>
            Let&apos;s talk about{" "}
            <span className="bg-gradient-to-r from-[var(--color-primary)] to-[oklch(0.52_0.14_240)] bg-clip-text text-transparent">
              secure healthcare software
            </span>
          </>
        }
        description="Whether you're onboarding an organization, evaluating the platform, or need a hand — the team is here to help."
        highlights={["Sales & onboarding", "Security questions", "Technical support"]}
      />

      <section className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          {/* Left: channels */}
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {CHANNELS.map((c) => {
                const Icon = c.icon;
                return (
                  <div
                    key={c.title}
                    className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-lift)]"
                  >
                    <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-sm transition-transform group-hover:scale-105">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-3 font-semibold">{c.title}</h3>
                    {c.lines.map((line) => (
                      <p key={line} className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                        {line}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)] ring-1 ring-inset ring-[var(--color-primary)]/15">
                <LifeBuoy className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Already a user?</h3>
                <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                  For account-specific help, sign in and use in-portal support so
                  your request is linked to your audited session.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-warning)]/20 text-[var(--color-warning)]">
                <ShieldAlert className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Never send PHI here</h3>
                <p className="mt-0.5 text-sm text-[var(--color-muted-foreground)]">
                  This form is not a secure channel for protected health
                  information. Keep medical details inside the portal.
                </p>
              </div>
            </div>
          </div>

          {/* Right: form */}
          <ContactForm />
        </div>
      </section>
    </>
  );
}
