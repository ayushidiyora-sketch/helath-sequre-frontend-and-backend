import {
  Hospital,
  Stethoscope,
  Building2,
  HeartPulse,
  Cross,
  Activity,
  Pill,
  Ambulance,
} from "lucide-react";

/** Fictional healthcare organizations shown in the trust marquee. */
const CLIENTS = [
  { name: "City General Hospital", icon: Hospital },
  { name: "Lakeside Medical Clinic", icon: Stethoscope },
  { name: "Northwell Care Group", icon: Building2 },
  { name: "Apollo Health Systems", icon: HeartPulse },
  { name: "BlueCross Regional", icon: Cross },
  { name: "Sunrise Telemedicine", icon: Activity },
  { name: "Wellspring Clinics", icon: Pill },
  { name: "Meridian Hospital Network", icon: Ambulance },
];

/**
 * Auto-scrolling "trusted by" strip of client healthcare organizations.
 * The list is rendered twice and translated -50% for a seamless loop;
 * the animation pauses while hovered.
 */
export function ClientMarquee() {
  const items = [...CLIENTS, ...CLIENTS];

  return (
    <section className="relative border-y border-[var(--color-border)] bg-[var(--color-card)]/40 py-10 backdrop-blur">
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
        Trusted by leading healthcare providers
      </p>

      <div className="group relative mt-6 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
        <div className="flex w-max animate-marquee items-center gap-4 group-hover:[animation-play-state:paused]">
          {items.map((client, i) => {
            const Icon = client.icon;
            return (
              <div
                key={i}
                className="flex shrink-0 items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2.5 opacity-70 transition-opacity hover:opacity-100"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.68_0.13_195)] to-[oklch(0.5_0.12_215)] text-white shadow-sm">
                  <Icon className="size-4" />
                </span>
                <span className="whitespace-nowrap text-sm font-semibold tracking-tight text-[var(--color-foreground)]">
                  {client.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
