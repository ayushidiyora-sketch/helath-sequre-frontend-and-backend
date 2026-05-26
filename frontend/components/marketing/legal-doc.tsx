import type { ReactNode } from "react";
import { ArrowUp } from "lucide-react";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

/** Stable anchor id for a section index. */
const anchor = (i: number) => `section-${i + 1}`;

/**
 * Renders a numbered, card-based legal document with a sticky table of
 * contents — shared by the Terms, Privacy, and HIPAA pages.
 */
export function LegalDoc({
  intro,
  sections,
}: {
  intro?: ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div id="doc-top" className="mx-auto max-w-6xl px-6 py-14">
      <div className="grid gap-10 lg:grid-cols-[230px_1fr]">
        {/* Sticky table of contents */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              On this page
            </p>
            <nav className="mt-3 space-y-0.5">
              {sections.map((section, i) => (
                <a
                  key={section.heading}
                  href={`#${anchor(i)}`}
                  className="group flex gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                >
                  <span className="text-xs font-semibold text-[var(--color-primary-700)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="leading-snug">{section.heading}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Document body */}
        <div>
          {intro && (
            <div className="mb-8 rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary-50)]/40 p-5 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              {intro}
            </div>
          )}

          <div className="space-y-5">
            {sections.map((section, i) => (
              <section
                key={section.heading}
                id={anchor(i)}
                className="scroll-mt-24 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-colors hover:border-[var(--color-primary)]/30 sm:p-7"
              >
                <h2 className="flex items-center gap-3 text-lg font-semibold tracking-tight text-[var(--color-foreground)]">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.52_0.12_215)] text-xs font-semibold text-white shadow-sm">
                    {i + 1}
                  </span>
                  {section.heading}
                </h2>
                <div className="mt-3.5 space-y-3 pl-11 text-sm leading-relaxed text-[var(--color-muted-foreground)] [&_a]:font-medium [&_a]:text-[var(--color-primary-700)] [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-[var(--color-foreground)] [&_ul]:space-y-1.5">
                  {section.body}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <a
              href="#doc-top"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-xs font-medium text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-primary)]/40 hover:text-[var(--color-foreground)]"
            >
              <ArrowUp className="size-3.5" /> Back to top
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
