"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";

const TOPICS = [
  "General enquiry",
  "Onboard my organization",
  "Sales & pricing",
  "Security & compliance",
  "Technical support",
];

/** Public contact form. Demo build — submission shows a confirmation toast. */
export function ContactForm() {
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    organization: "",
    topic: TOPICS[0],
    message: "",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    // Demo build: no inbox is wired — acknowledge and reset.
    await new Promise((r) => setTimeout(r, 800));
    setSending(false);
    toast.success("Message sent", {
      description: `Thanks, ${form.name.split(" ")[0] || "there"} — our team will reply within one business day.`,
    });
    setForm({ name: "", email: "", organization: "", topic: TOPICS[0], message: "" });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-lift)]"
    >
      {/* Gradient header band */}
      <div className="relative overflow-hidden border-b border-[var(--color-border)] bg-gradient-to-br from-[oklch(0.96_0.025_200)] to-[oklch(0.96_0.025_158)] px-6 py-5 sm:px-8">
        <div className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-gradient-to-br from-[oklch(0.7_0.15_200)] to-transparent opacity-30 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-sm">
            <Send className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Send us a message</h2>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              We&apos;ll get back to you within one business day.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6 sm:p-8">
        <p className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-3 py-2 text-xs text-[var(--color-muted-foreground)]">
          Please don&apos;t include any protected health information in this form.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Jordan Rivera"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="organization">Organization (optional)</Label>
          <Input
            id="organization"
            value={form.organization}
            onChange={(e) => set("organization", e.target.value)}
            placeholder="City General Hospital"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="topic">How can we help?</Label>
          <select
            id="topic"
            value={form.topic}
            onChange={(e) => set("topic", e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
          >
            {TOPICS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            required
            rows={5}
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="Tell us a little about what you need…"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={sending}>
          {sending ? (
            <>
              <Loader2 className="animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Send /> Send message
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
