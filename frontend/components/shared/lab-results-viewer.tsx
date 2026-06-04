import { Badge } from "@/components/ui/badge";
import type { ResultRow } from "@/app/patient/records/records-data";

/**
 * Lab results viewer. Renders each marker with its value, reference range, an
 * out-of-range flag, and — when numeric bounds are present — a reference-range
 * bar that shows where the value sits relative to the normal band. Falls back
 * gracefully to a plain value/reference row when a marker has no numerics.
 */
export function LabResultsViewer({ results }: { results: ResultRow[] }) {
  const flagged = results.map((r) => ({ row: r, flag: flagFor(r) }));
  const abnormal = flagged.filter((f) => f.flag !== "normal").length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {results.length} marker{results.length === 1 ? "" : "s"}
        </p>
        {abnormal > 0 ? (
          <Badge variant="warning" size="sm" dot>
            {abnormal} out of range
          </Badge>
        ) : (
          <Badge variant="success" size="sm" dot>
            All within range
          </Badge>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
        <div className="hidden grid-cols-[1.4fr_1fr_2fr_auto] gap-3 border-b border-[var(--color-border)] bg-[var(--color-muted)]/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)] sm:grid">
          <span>Marker</span>
          <span className="text-right">Result</span>
          <span>Reference range</span>
          <span className="text-right">Status</span>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {flagged.map(({ row, flag }) => (
            <li
              key={row.marker}
              className="grid grid-cols-2 items-center gap-x-3 gap-y-2 px-4 py-3 text-sm sm:grid-cols-[1.4fr_1fr_2fr_auto]"
            >
              <span className="font-medium">{row.marker}</span>
              <span
                className={`text-right font-mono tabular-nums ${
                  flag === "normal" ? "" : "font-semibold text-[var(--color-warning-foreground)]"
                }`}
              >
                {row.result}
              </span>
              <div className="col-span-2 sm:col-span-1">
                <RangeBar row={row} flag={flag} />
              </div>
              <div className="text-right">
                <FlagBadge flag={flag} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RangeBar({ row, flag }: { row: ResultRow; flag: Flag }) {
  const { value, low, high } = row;
  if (value === undefined || low === undefined || high === undefined) {
    return (
      <p className="text-xs text-[var(--color-muted-foreground)]">{row.reference}</p>
    );
  }

  const span = Math.max(high - low, 1e-6);
  const domainMin = Math.min(low, value) - span * 0.2;
  const domainMax = Math.max(high, value) + span * 0.2;
  const pct = (x: number) =>
    Math.max(0, Math.min(100, ((x - domainMin) / (domainMax - domainMin)) * 100));

  const normalLeft = pct(low);
  const normalWidth = pct(high) - normalLeft;
  const markerLeft = pct(value);
  const dot =
    flag === "normal"
      ? "bg-[var(--color-success)]"
      : flag === "critical"
        ? "bg-[var(--color-danger)]"
        : "bg-[var(--color-warning)]";

  return (
    <div className="space-y-1">
      <div className="relative h-2 rounded-full bg-[var(--color-muted)]">
        {/* Normal band */}
        <div
          className="absolute inset-y-0 rounded-full bg-[var(--color-success-soft)]"
          style={{ left: `${normalLeft}%`, width: `${normalWidth}%` }}
        />
        {/* Value marker */}
        <div
          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--color-card)] ${dot}`}
          style={{ left: `${markerLeft}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-[var(--color-muted-foreground)]">
        <span>{low}</span>
        <span>Normal range{row.unit ? ` · ${row.unit}` : ""}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

function FlagBadge({ flag }: { flag: Flag }) {
  if (flag === "normal") return <Badge variant="success" size="sm" dot>Normal</Badge>;
  if (flag === "critical") return <Badge variant="danger" size="sm" dot>Critical</Badge>;
  if (flag === "high") return <Badge variant="warning" size="sm" dot>High ↑</Badge>;
  return <Badge variant="warning" size="sm" dot>Low ↓</Badge>;
}

type Flag = "low" | "normal" | "high" | "critical";

function flagFor(row: ResultRow): Flag {
  if (row.flag) return row.flag;
  if (row.value !== undefined && row.low !== undefined && row.high !== undefined) {
    if (row.value < row.low) return "low";
    if (row.value > row.high) return "high";
    return "normal";
  }
  return row.ok ? "normal" : "high";
}
