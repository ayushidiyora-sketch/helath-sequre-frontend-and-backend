import type { ComponentType, ReactNode } from "react";
import Image from "next/image";

interface PageHeroProps {
  eyebrow: string;
  /** Optional Lucide icon shown in the eyebrow pill. */
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  description: string;
  /** Optional meta line, e.g. a "Last updated" date for legal pages. */
  meta?: string;
  /** Optional short chips shown beneath the description. */
  highlights?: string[];
  /** Banner background image path (under /public). */
  image?: string;
}

/** Consistent, layered top-of-page hero for the public marketing pages. */
export function PageHero({
  eyebrow,
  icon: Icon,
  title,
  description,
  meta,
  highlights,
  image = "/hero-health.jpg",
}: PageHeroProps) {
  return (
    <section className="relative isolate overflow-hidden border-b border-[var(--color-border)]">
      {/* Health-facility banner image */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Black overlay so the white heading text stays clearly legible */}
        <div className="absolute inset-0 bg-black/8" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/75" />
      </div>
      {/* Faint dot grid for texture */}
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-[0.12] [mask-image:linear-gradient(to_bottom,black,transparent)]" />

      <div className="relative mx-auto max-w-3xl px-6 py-20 text-center sm:py-24">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/80 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-primary-700)] shadow-sm backdrop-blur">
          {Icon ? (
            <Icon className="size-3.5" />
          ) : (
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-50" />
              <span className="relative inline-flex size-2 rounded-full bg-[var(--color-primary)]" />
            </span>
          )}
          {eyebrow}
        </div>

        <h1 className="mt-6 text-3xl font-semibold leading-[1.12] tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-[2.85rem]">
          {title}
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
          {description}
        </p>

        {highlights && highlights.length > 0 && (
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            {highlights.map((h) => (
              <span
                key={h}
                className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur"
              >
                {h}
              </span>
            ))}
          </div>
        )}

        {meta && (
          <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white backdrop-blur">
            <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
            {meta}
          </p>
        )}
      </div>

      
   
    </section>
  );
}
