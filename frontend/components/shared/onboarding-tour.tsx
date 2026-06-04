"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Compass, ChevronRight, ChevronLeft, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * First-time onboarding tour for staff dashboards (clinician, admin, compliance,
 * auditor, super). A spotlight walkthrough that highlights the key surfaces of
 * the workspace the first time a user signs in.
 *
 * Anchoring: each step optionally targets an element by its `data-tour="<anchor>"`
 * attribute (added to the sidebar nav, header search, bell, MFA chip, and profile
 * menu). A step whose anchor is not in the DOM (e.g. the collapsed mobile sidebar)
 * falls back to a centered card, so the tour never breaks on narrow screens.
 *
 * Persistence: completion/skip is remembered per role in localStorage under
 * `hs_tour_<role>_v1`, so the tour only auto-runs once. It can be replayed from
 * the "Take a tour" item in the profile menu, which dispatches `hs:start-tour`.
 */

export interface TourStep {
  /** `data-tour` value of the element to spotlight. Omit for a centered step. */
  anchor?: string;
  title: string;
  body: string;
}

const STORAGE_VERSION = "v1";
const START_EVENT = "hs:start-tour";
/** Padding (px) drawn around the spotlighted element. */
const SPOT_PAD = 8;
const CARD_WIDTH = 320;

/** Per-role default tours. Steps gracefully degrade when an anchor is absent. */
export const TOURS: Record<string, TourStep[]> = {
  clinician: [
    { title: "Welcome to your clinical workspace", body: "A quick 60-second tour of where everything lives. You can replay it anytime from the profile menu." },
    { anchor: "nav-patients", title: "Your patient panel", body: "Every patient assigned to you. Open a chart to see records, notes, and the timeline — all consent-gated." },
    { anchor: "nav-schedule", title: "Today's schedule", body: "Your appointments and availability. Set slot templates and block time from here." },
    { anchor: "nav-messages", title: "Secure messaging", body: "Encrypted threads with your patients. Unread counts show as a red badge." },
    { anchor: "header-search", title: "Jump anywhere", body: "Search to jump straight to any page in your workspace." },
    { anchor: "header-mfa", title: "Protected session", body: "Your session is MFA-protected and auto-locks after 15 minutes of inactivity. Every PHI action is audit-logged." },
    { anchor: "header-profile", title: "You're all set", body: "Manage your profile, settings, and sign out from here. Welcome aboard!" },
  ],
  admin: [
    { title: "Welcome to the admin console", body: "A quick tour of how you run your organization on HealthSecure. Replay anytime from the profile menu." },
    { anchor: "nav-users", title: "Staff & roles", body: "Invite clinicians and admin staff, assign roles, and manage account status." },
    { anchor: "nav-patients", title: "Patient roster", body: "Onboard patients, assign them to clinicians, and run bulk invites." },
    { anchor: "nav-departments", title: "Departments & schedules", body: "Set up departments, working hours, and clinician assignment." },
    { anchor: "header-search", title: "Jump anywhere", body: "Search to jump straight to any page in the console." },
    { anchor: "header-mfa", title: "Protected session", body: "MFA-protected, auto-locks after 15 minutes idle, and every administrative action is audit-logged." },
    { anchor: "header-profile", title: "You're all set", body: "Profile, settings, and sign-out live here. Welcome aboard!" },
  ],
  compliance: [
    { title: "Welcome, Compliance Manager", body: "A quick tour of your compliance and audit surfaces. Replay anytime from the profile menu." },
    { anchor: "nav-audit-logs", title: "Audit log viewer", body: "Filter, drill into, and export the immutable event ledger across the tenant." },
    { anchor: "nav-anomalies", title: "Anomaly review", body: "Off-hours access, bulk downloads, and repeated failures surface here for triage and escalation." },
    { anchor: "nav-consent-policies", title: "Consent policies", body: "Author and version the consent policy templates patients sign against." },
    { anchor: "header-search", title: "Jump anywhere", body: "Search to jump straight to any compliance page." },
    { anchor: "header-mfa", title: "Protected session", body: "MFA-protected and auto-locks after 15 minutes idle. Your reviews are themselves audit-logged." },
    { anchor: "header-profile", title: "You're all set", body: "Profile, settings, and sign-out live here. Welcome aboard!" },
  ],
  auditor: [
    { title: "Welcome, Auditor", body: "A quick tour of your read-only audit surfaces. Replay anytime from the profile menu." },
    { anchor: "nav-audit-logs", title: "Audit log viewer", body: "Browse and drill into the full event ledger. Read-only — you can view and export, never modify." },
    { anchor: "nav-consents", title: "Consent records", body: "Review active and historical consents and their policy versions." },
    { anchor: "nav-reports", title: "Reports & exports", body: "Generate and download audit and compliance reports as PDF or CSV." },
    { anchor: "header-search", title: "Jump anywhere", body: "Search to jump straight to any page." },
    { anchor: "header-mfa", title: "Protected session", body: "MFA-protected and auto-locks after 15 minutes of inactivity." },
    { anchor: "header-profile", title: "You're all set", body: "Profile, settings, and sign-out live here. Welcome aboard!" },
  ],
  super: [
    { title: "Welcome, Super Admin", body: "A quick tour of the platform operator console. Replay anytime from the profile menu." },
    { anchor: "nav-tenants", title: "Tenant management", body: "Provision and configure organizations across the platform." },
    { anchor: "nav-health", title: "Platform health", body: "Monitor uptime, performance, and system status at a glance." },
    { anchor: "nav-break-glass", title: "Break-glass access", body: "Emergency, fully-audited PHI access with mandatory justification and re-MFA." },
    { anchor: "header-search", title: "Jump anywhere", body: "Search to jump straight to any platform page." },
    { anchor: "header-mfa", title: "Protected session", body: "MFA-protected and auto-locks after 15 minutes idle. Cross-tenant actions are explicitly audited." },
    { anchor: "header-profile", title: "You're all set", body: "Profile, settings, and sign-out live here. Welcome aboard!" },
  ],
};

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingTour({ role, steps }: { role: string; steps?: TourStep[] }) {
  const tourSteps = useMemo(() => steps ?? TOURS[role] ?? [], [steps, role]);
  const storageKey = `hs_tour_${role}_${STORAGE_VERSION}`;

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<SpotRect | null>(null);
  const startTimer = useRef<number | null>(null);

  const finish = useCallback(() => {
    setActive(false);
    setRect(null);
    try {
      window.localStorage.setItem(storageKey, "done");
    } catch {
      // Private-mode / storage-disabled: tour just runs again next visit.
    }
  }, [storageKey]);

  const begin = useCallback(() => {
    if (tourSteps.length === 0) return;
    setIndex(0);
    setActive(true);
  }, [tourSteps.length]);

  // Auto-start once for first-time users; always listen for a manual replay.
  useEffect(() => {
    if (tourSteps.length === 0) return;
    let seen = "done";
    try {
      seen = window.localStorage.getItem(storageKey) ?? "";
    } catch {
      seen = "";
    }
    if (!seen) {
      // Let the layout (sidebar/header) paint before measuring anchors.
      startTimer.current = window.setTimeout(begin, 600);
    }
    const onStart = () => begin();
    window.addEventListener(START_EVENT, onStart);
    return () => {
      if (startTimer.current) window.clearTimeout(startTimer.current);
      window.removeEventListener(START_EVENT, onStart);
    };
  }, [begin, storageKey, tourSteps.length]);

  // Measure the current step's anchor (scroll it into view first).
  const measure = useCallback(() => {
    const step = tourSteps[index];
    if (!step?.anchor) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [index, tourSteps]);

  useLayoutEffect(() => {
    if (!active) return;
    const step = tourSteps[index];
    const el = step?.anchor
      ? document.querySelector<HTMLElement>(`[data-tour="${step.anchor}"]`)
      : null;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    const raf = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(raf);
  }, [active, index, measure, tourSteps]);

  useEffect(() => {
    if (!active) return;
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, true);
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange, true);
    };
  }, [active, measure]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= tourSteps.length - 1) {
        finish();
        return i;
      }
      return i + 1;
    });
  }, [finish, tourSteps.length]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Keyboard controls.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, back, finish, next]);

  if (!active || tourSteps.length === 0) return null;

  const step = tourSteps[index];
  const isLast = index === tourSteps.length - 1;
  const isFirst = index === 0;

  // Card placement: below the anchor if there's room, otherwise above; centered
  // when there's no anchor.
  let cardStyle: React.CSSProperties;
  if (rect) {
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    const placeBelow = spaceBelow > 240;
    const left = Math.min(
      Math.max(rect.left, 12),
      window.innerWidth - CARD_WIDTH - 12,
    );
    cardStyle = placeBelow
      ? { top: rect.top + rect.height + SPOT_PAD + 12, left }
      : { top: rect.top - SPOT_PAD - 12, left, transform: "translateY(-100%)" };
  } else {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Product tour">
      {/* Click-capture / dim layer. Transparent when spotlighting (the spotlight
          ring provides the dim via box-shadow); dimmed for centered steps. */}
      <div
        className={rect ? "absolute inset-0" : "absolute inset-0 bg-black/55 backdrop-blur-[1px]"}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Spotlight ring around the anchored element. */}
      {rect && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-[var(--color-primary)] transition-all duration-300"
          style={{
            top: rect.top - SPOT_PAD,
            left: rect.left - SPOT_PAD,
            width: rect.width + SPOT_PAD * 2,
            height: rect.height + SPOT_PAD * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      )}

      {/* Step card. */}
      <div
        className="absolute w-80 max-w-[calc(100vw-24px)] animate-[fade-in_0.2s_ease-out] rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-2xl"
        style={cardStyle}
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary)]">
            <Compass className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
              Tour · {index + 1} / {tourSteps.length}
            </p>
            <h3 className="text-sm font-semibold leading-tight text-[var(--color-foreground)]">
              {step.title}
            </h3>
          </div>
          <button
            onClick={finish}
            aria-label="Skip tour"
            className="rounded-md p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">{step.body}</p>

        {/* Progress dots. */}
        <div className="mb-4 flex items-center gap-1.5">
          {tourSteps.map((_, i) => (
            <span
              key={i}
              className={
                i === index
                  ? "h-1.5 w-5 rounded-full bg-[var(--color-primary)] transition-all"
                  : "h-1.5 w-1.5 rounded-full bg-[var(--color-border)] transition-all"
              }
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={back}>
                <ChevronLeft /> Back
              </Button>
            )}
            <Button size="sm" onClick={next}>
              {isLast ? (
                <>
                  <Check /> Finish
                </>
              ) : (
                <>
                  Next <ChevronRight />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
