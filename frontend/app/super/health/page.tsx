import {
  Activity,
  Globe,
  Database,
  Server,
  Mail,
  MessageSquare,
  HardDrive,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/page-header";

const services = [
  { name: "API · /v1", uptime: "99.96%", latency: 168, status: "healthy" as const, icon: Server },
  { name: "Worker (BullMQ)", uptime: "99.92%", latency: 22, status: "healthy" as const, icon: Activity },
  { name: "PostgreSQL primary", uptime: "100%", latency: 4, status: "healthy" as const, icon: Database },
  { name: "S3 storage", uptime: "100%", latency: 38, status: "healthy" as const, icon: HardDrive },
  { name: "SendGrid", uptime: "98.4%", latency: 412, status: "degraded" as const, icon: Mail },
  { name: "Twilio SMS", uptime: "99.7%", latency: 184, status: "healthy" as const, icon: MessageSquare },
];

export default function HealthPage() {
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Platform health"
        description="Real-time service status, latency, and uptime against SLOs."
      />

      <div className="rounded-2xl border border-[var(--color-success)]/30 bg-[var(--color-success-soft)]/30 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-card)] text-[var(--color-success)] ring-1 ring-[var(--color-success)]/30">
            <CheckCircle2 className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">All critical services nominal</p>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              Minor degradation on SendGrid latency in eu-west-1. Auto-mitigation engaged at 11:42 UTC.
            </p>
          </div>
          <Badge variant="success" size="sm" dot className="ml-auto">Healthy</Badge>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {services.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.name} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`flex size-10 items-center justify-center rounded-xl ${s.status === "healthy" ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "bg-[var(--color-warning-soft)] text-[oklch(0.5_0.14_75)] dark:text-[oklch(0.85_0.13_80)]"}`}>
                    <Icon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-[11px] text-[var(--color-muted-foreground)]">uptime {s.uptime} · p95 latency {s.latency} ms</p>
                  </div>
                </div>
                {s.status === "healthy" ? <Badge variant="success" size="sm" dot>Healthy</Badge> : <Badge variant="warning" size="sm" dot>Degraded</Badge>}
              </div>
              <Progress value={parseFloat(s.uptime)} className="mt-4" />
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h2 className="text-sm font-semibold inline-flex items-center gap-2"><Clock className="size-4" /> Maintenance windows</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {[
            { region: "ap-south-1", t: "May 24 · 02:00 – 03:00 IST", status: "Scheduled" },
            { region: "eu-west-1", t: "May 25 · 23:00 – 23:30 BST", status: "Tentative" },
          ].map((m) => (
            <li key={m.t} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] p-3 text-xs">
              <Globe className="size-4 text-[var(--color-muted-foreground)]" />
              <span className="flex-1"><span className="font-medium text-[var(--color-foreground)]">{m.region}</span> · {m.t}</span>
              <Badge variant="muted" size="sm">{m.status}</Badge>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
