import React from "react";

/**
 * Wrap case-insensitive matches of `query` in `text` with a <mark>. Used by the
 * in-conversation message search to highlight hits inside message bubbles.
 * Returns the raw string when the query is empty.
 */
export function highlightText(text: string, query: string): React.ReactNode {
  const needle = query.trim().toLowerCase();
  if (!needle) return text;
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      out.push(text.slice(i));
      break;
    }
    if (idx > i) out.push(text.slice(i, idx));
    out.push(
      <mark key={key++} className="rounded bg-[var(--color-warning)]/50 px-0.5 text-inherit">
        {text.slice(idx, idx + needle.length)}
      </mark>,
    );
    i = idx + needle.length;
  }
  return out;
}
