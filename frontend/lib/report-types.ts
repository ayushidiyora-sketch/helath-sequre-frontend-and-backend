/** Shared types for the auditor/compliance report API response shape. */
export interface ReportStat { label: string; value: string; sub?: string }
export type ReportSection =
  | { kind: "paragraph"; heading?: string; text: string }
  | { kind: "stats"; heading?: string; stats: ReportStat[] }
  | { kind: "table"; heading?: string; columns: string[]; rows: (string | number)[][]; empty?: string };

export interface ReportPayload {
  key: string;
  title: string;
  description: string;
  generatedAt: string;
  generatedAtLabel?: string;
  windowStart: string | null;
  windowEnd: string | null;
  sections: ReportSection[];
}
