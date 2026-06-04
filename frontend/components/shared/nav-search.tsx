"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";

export interface NavSearchItem {
  href: string;
  label: string;
  group?: string;
}

/**
 * Header search that searches the role's sidebar navigation.
 * Typing filters the nav items; clicking a result (or pressing Enter)
 * navigates to that page.
 */
export function NavSearch({
  items,
  placeholder,
  dataTour,
}: {
  items: NavSearchItem[];
  placeholder: string;
  dataTour?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const results = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : [];

  function go(href: string) {
    setQuery("");
    setOpen(false);
    router.push(href);
  }

  return (
    <div data-tour={dataTour} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 z-20 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
      <input
        type="search"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) go(results[0].href);
          else if (e.key === "Escape") setOpen(false);
        }}
        className="relative z-20 h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] pl-10 pr-16 text-sm placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15"
      />
      <kbd className="pointer-events-none absolute right-2.5 top-1/2 z-20 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted-foreground)] sm:inline-flex">
        ⌘K
      </kbd>

      {open && q && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-12 z-20 w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-[var(--shadow-lift)]">
            <p className="border-b border-[var(--color-border)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Pages
            </p>
            {results.length === 0 ? (
              <p className="px-3 py-3 text-xs text-[var(--color-muted-foreground)]">
                No pages match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <ul className="max-h-72 overflow-y-auto py-1">
                {results.map((r) => (
                  <li key={r.href}>
                    <button
                      type="button"
                      onClick={() => go(r.href)}
                      className="group flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-[var(--color-muted)]"
                    >
                      <Search className="size-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                      <span className="flex-1 truncate">{r.label}</span>
                      {r.group && (
                        <span className="shrink-0 text-[10px] text-[var(--color-muted-foreground)]">
                          {r.group}
                        </span>
                      )}
                      <ArrowRight className="size-3.5 shrink-0 text-[var(--color-muted-foreground)] opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
