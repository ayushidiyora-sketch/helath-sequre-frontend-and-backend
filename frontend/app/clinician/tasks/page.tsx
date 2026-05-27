"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileSignature, Pill, MessageSquare, FileImage, Clock, AlertCircle, CheckCircle2, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { useClinicianStore, type ClinicianTask, type TaskType } from "@/lib/clinician-store";

const TYPE_META: Record<TaskType, { title: string; icon: LucideIcon }> = {
  sign_note: { title: "Awaiting your signature", icon: FileSignature },
  approve_rx: { title: "Prescription approvals", icon: Pill },
  reply_message: { title: "Messages awaiting reply", icon: MessageSquare },
  review_imaging: { title: "Imaging review", icon: FileImage },
};

export default function TasksPage() {
  const { state, completeTask } = useClinicianStore();
  const [showCompleted, setShowCompleted] = useState(false);

  const open = state.tasks.filter((t) => !t.completedAt);
  const done = state.tasks.filter((t) => !!t.completedAt);
  const visible = showCompleted ? done : open;

  // Compute before any early return so hook order stays stable.
  const groups = useMemo(() => {
    const out: { type: TaskType; items: ClinicianTask[] }[] = [];
    for (const type of Object.keys(TYPE_META) as TaskType[]) {
      const items = visible.filter((t) => t.type === type);
      if (items.length > 0) out.push({ type, items });
    }
    return out;
  }, [visible]);

  if (!state.hydrated) {
    return <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">Loading…</div>;
  }

  const urgentCount = open.filter((t) => t.urgent).length;
  const medianAgeMs = (() => {
    if (open.length === 0) return 0;
    const ages = open.map((t) => Date.now() - new Date(t.createdAt).getTime()).sort((a, b) => a - b);
    return ages[Math.floor(ages.length / 2)];
  })();
  const medianAgeLabel = (() => {
    if (medianAgeMs === 0) return "—";
    const h = Math.round(medianAgeMs / 3_600_000);
    if (h < 24) return `${h}h`;
    return `${Math.round(h / 24)}d`;
  })();

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="What needs your attention"
        description="Tasks roll up from notes, prescriptions, messages, and imaging. Mark them done as you work through."
        actions={
          <Button
            variant={showCompleted ? "default" : "outline"}
            size="sm"
            onClick={() => setShowCompleted((v) => !v)}
          >
            {showCompleted ? "Show open" : `Show completed (${done.length})`}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Open tasks" value={open.length} icon={Clock} />
        <Stat label="Urgent" value={urgentCount} icon={AlertCircle} accent="danger" />
        <Stat label="Done total" value={done.length} icon={CheckCircle2} accent="success" />
        <Stat label="Median age" value={medianAgeLabel} icon={Clock} />
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-card)] p-12 text-center">
          <CheckCircle2 className="size-7 text-[var(--color-success)]" />
          <p className="text-sm font-semibold">{showCompleted ? "No completed tasks yet" : "All caught up — no pending tasks"}</p>
          <p className="max-w-md text-xs text-[var(--color-muted-foreground)]">
            {showCompleted
              ? "Tasks you complete will land here for reference."
              : "New tasks appear here when notes await signing, prescriptions need approval, or messages come in."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((g) => {
            const Icon = TYPE_META[g.type].icon;
            return (
              <div key={g.type} className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-semibold">{TYPE_META[g.type].title}</h2>
                      <p className="text-[11px] text-[var(--color-muted-foreground)]">{g.items.length} {showCompleted ? "completed" : "open"}</p>
                    </div>
                  </div>
                </div>
                <ul className="divide-y divide-[var(--color-border)]">
                  {g.items.map((t) => (
                    <li key={t.id} className="flex items-center gap-3 p-4 hover:bg-[var(--color-muted)]/40">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{t.title}</p>
                        <p className="text-[10px] text-[var(--color-muted-foreground)]">{t.subtitle}</p>
                      </div>
                      {t.urgent && !showCompleted && <Badge variant="warning" size="sm" dot>Urgent</Badge>}
                      {!showCompleted && (
                        <>
                          {t.href && (
                            <Button asChild size="sm" variant="ghost">
                              <Link href={t.href}>Open</Link>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              completeTask(t.id);
                              toast.success("Task marked done", { description: t.title });
                            }}
                          >
                            <CheckCircle2 /> Done
                          </Button>
                        </>
                      )}
                      {showCompleted && t.completedAt && (
                        <Badge variant="success" size="sm" dot>
                          Done {new Date(t.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: LucideIcon; accent?: "danger" | "success" }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted-foreground)]">
        <Icon className={`size-3.5 ${accent === "danger" ? "text-[var(--color-danger)]" : accent === "success" ? "text-[var(--color-success)]" : ""}`} /> {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
