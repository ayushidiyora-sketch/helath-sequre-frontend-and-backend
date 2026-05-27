# HealthSecure Portal — Project Knowledge Base

> Single source of truth for this project. Update this file at the end of every task per `CLAUDE.md` rules.

---

## 1. Project Overview

- **Name:** HealthSecure Portal — HIPAA-Ready Patient Portal
- **Type:** Web-only multi-tenant healthcare portal (responsive desktop / tablet / mobile browsers)
- **Owner:** Sensussoft Software Pvt Ltd
- **Phase:** Frontend complete; backend not yet started (pre-backend development checkpoint)
- **Compliance targets:** HIPAA, GDPR, HL7/FHIR-ready, FDA 21 CFR Part 11, SOC 2 (readiness posture)
- **Repository:** https://github.com/Sensussoft-Software/Health_Secure_Portal.git
- **Current branch:** `ayushi` (main is `main`)

---

## 2. Tech Stack (Frontend, current)

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.5.18 |
| Language | TypeScript | 5.7.3 |
| UI library | React | 19.0.0 |
| Styling | Tailwind CSS | 4.3.0 |
| PostCSS | postcss | 8.5.15 (override) |
| Icons | lucide-react | 0.469.0 |
| Toasts | sonner | 2.0.7 |
| Date utilities | date-fns | 4.1.0 |
| Auth utility | jose (JWT) | 6.2.3 |
| PDF generation | jspdf + jspdf-autotable | 4.2.1 / 5.0.8 |
| Radix primitives | avatar, dialog, dropdown-menu, popover, progress, scroll-area, separator, slot, switch, tabs, tooltip | various |
| Linting | ESLint + eslint-config-next | 9.39.4 / 15.5.18 |

### Mandated stack from requirement doc — NOT yet installed

These libraries are required per the requirement doc but not yet in `package.json`. Must install before backend integration:

- `react-hook-form` — form management
- `zod` — schema validation
- `@tanstack/react-query` — server state
- `axios` — HTTP client
- `zustand` (or `@reduxjs/toolkit`) — client global state
- `i18next` + `react-i18next` — internationalization
- `husky` + `lint-staged` — pre-commit hooks

---

## 3. Repository Structure

```
d:/helathsecure/                  ← project root
├── CLAUDE.md                     ← Claude Code session rules
├── KNOWLEDGE.md                  ← THIS FILE
├── frontend/                     ← Next.js app
│   ├── app/                      ← App Router routes
│   │   ├── (auth)/               ← Auth pages (login, MFA, etc.)
│   │   ├── (marketing)/          ← Public pages
│   │   ├── api/                  ← API route handlers (auth stubs only)
│   │   ├── patient/              ← Patient portal
│   │   ├── clinician/            ← Clinician workspace
│   │   ├── admin/                ← Org admin console
│   │   ├── compliance/           ← Compliance manager dashboard
│   │   ├── auditor/              ← Auditor (read-only)
│   │   ├── super/                ← Super admin (platform)
│   │   ├── globals.css           ← Tailwind v4 tokens + theme
│   │   ├── layout.tsx            ← Root layout (fonts, Toaster)
│   │   └── page.tsx              ← Landing
│   ├── components/
│   │   ├── auth/                 ← Auth-specific UI
│   │   ├── marketing/            ← Marketing site UI
│   │   ├── patient/              ← Patient-only header/sidebar
│   │   ├── shared/               ← Cross-role shared components
│   │   └── ui/                   ← Base UI primitives (button, dialog, input, etc.)
│   ├── lib/
│   │   ├── auth.ts               ← JWT signing/verification (jose)
│   │   ├── patient-store.tsx     ← Patient role local store (localStorage)
│   │   ├── clinician-store.tsx   ← Clinician role local store
│   │   ├── admin-store.tsx       ← Org admin local store
│   │   ├── demo-users.ts         ← Seed user accounts for demo
│   │   ├── login-href.ts         ← Role → login URL helpers
│   │   ├── report-generators.ts  ← PDF/CSV report builders
│   │   └── utils.ts              ← Tailwind cn() helper
│   ├── middleware.ts             ← Auth gate + role-based redirects
│   ├── next.config.ts            ← Security headers + image config
│   ├── package.json
│   └── tsconfig.json
└── report.txt                    ← Last build report (transient)
```

---

## 4. User Roles

The portal supports **6 distinct roles**. Each has its own route prefix, sidebar, and store (where stateful).

| Role | Route prefix | Store | Purpose |
|---|---|---|---|
| Patient | `/patient/*` | `lib/patient-store.tsx` | Own PHI, appointments, consents, messages |
| Clinician | `/clinician/*` | `lib/clinician-store.tsx` | Assigned patients, schedule, notes, prescriptions |
| Org Admin | `/admin/*` | `lib/admin-store.tsx` | Tenant-scoped user/patient/dept mgmt |
| Compliance Manager | `/compliance/*` | (local component state) | Audit logs, policies, anomalies, approvals |
| Auditor | `/auditor/*` | (local component state) | Read-only audit + consent + reports |
| Super Admin | `/super/*` | (local component state) | Cross-tenant platform mgmt |

Marketing/public pages live under `app/(marketing)/*` (no auth).
Auth pages under `app/(auth)/*` (no auth required).

---

## 5. Module Inventory (frontend pages — current state)

All pages listed are present unless marked otherwise. See changelog for additions.

### 5.1 Authentication (`app/(auth)/*`)

`/login` · `/register` · `/forgot-password` · `/reset-password` · `/verify-email` · `/mfa-setup` · `/mfa-challenge` · `/mfa-prompt` · `/mfa-recovery-codes` · `/invite/[token]` · `/account-locked` · `/staff-login` · `/super-login`

### 5.2 Patient (`app/patient/*`)

`/dashboard` · `/records` (+ `[id]`) · `/appointments` (+ `new`, `[id]`) · `/documents` (+ `upload`) · `/consents` (+ `[id]`, `grant`) · `/messages` (+ `[threadId]`) · `/prescriptions` · `/family` · `/emergency` · `/insurance` · `/vaccinations` · `/notifications` · `/settings`

### 5.3 Clinician (`app/clinician/*`)

`/dashboard` · `/patients` (+ `[id]`, `[id]/records`, `[id]/records/new`, `[id]/documents`, `[id]/timeline`) · `/schedule` · `/appointments` (+ `[id]`) · `/messages` (+ `[threadId]`) · `/notes` (+ `new`) · `/prescriptions/[id]` · `/tasks` · `/notifications` · `/settings`

### 5.4 Org Admin (`app/admin/*`)

`/dashboard` · `/users` (+ `invite`, `bulk`) · `/patients` (+ `invite`, `bulk`, `[id]`, `[id]/edit`) · `/clinicians` (+ `invite`, `[id]`) · `/departments` (+ `new`) · `/appointments` · `/billing` · `/consents/campaign` · `/reports` · `/templates` · `/notifications` · `/settings`

### 5.5 Compliance Manager (`app/compliance/*`)

`/dashboard` · `/audit-logs` (+ `[id]`) · `/consents` (+ `[id]`) · `/consent-policies` (+ `new`, `[version]`, `[version]/edit`) · `/anomalies` (+ `[id]`) · `/approvals` (+ `[id]`) · `/campaigns` (+ `[id]`) · `/deletion-requests` (+ `[id]`) · `/retention` · `/reports` · `/notifications` · `/settings`

### 5.6 Auditor (`app/auditor/*`)

`/dashboard` · `/audit-logs` (+ `[id]`) · `/consents` · `/reports` · `/notifications` · `/settings`

### 5.7 Super Admin (`app/super/*`)

`/dashboard` · `/tenants` (+ `new`) · `/platform` (+ `integrations/[slug]`) · `/health` · `/security` · `/incidents` · `/integrations` · `/break-glass` · `/notifications` · `/settings`

### 5.8 Marketing (`app/(marketing)/*`)

`/` · `/about` · `/services` · `/pricing` · `/hipaa` · `/privacy` · `/terms` · `/contact` · `/checkout` (ahead of plan — billing is out of Phase 1 scope)

---

## 6. Shared Components (`components/shared/`)

| Component | File | Purpose |
|---|---|---|
| `action-button.tsx` | Confirm modal + toast wiring for destructive actions |
| `consent-denied-card.tsx` | PHI access-denied empty state; supports `onRequestAccess` CTA |
| `empty-state.tsx` | Standard empty-list state |
| `form-dialogs.tsx` | Invite patient / staff dialogs with token preview |
| `idle-timeout.tsx` | 15-min inactivity timer + 30s warning countdown |
| `logo.tsx` | HealthSecure brand mark |
| `logout-button.tsx` | Session-clearing logout |
| `nav-search.tsx` | Cmd-K style page search (sidebar-aware) |
| `notifications-list.tsx` | Reusable notification feed |
| `page-header.tsx` | Standard role-page header (eyebrow, title, description, actions) |
| `report-download-button.tsx` | Trigger PDF/CSV report generation |
| `role-header.tsx` | Top bar with search, MFA chip, theme toggle, notification bell (links to `notificationsHref`), profile menu |
| `role-mobile-nav.tsx` | Hamburger drawer nav for narrow screens |
| `role-sidebar.tsx` | Desktop sidebar (groups + utility items) |
| `security-badge.tsx` | 6 variants: encrypted, audited, consent-bound, PHI, MFA, verified |

### Base UI primitives (`components/ui/`)

`avatar.tsx` · `badge.tsx` · `button.tsx` · `card.tsx` · `dialog.tsx` · `dropdown-menu.tsx` · `input.tsx` (also exports `Textarea`, `Label`) · `progress.tsx` · `separator.tsx` · `switch.tsx` · `tabs.tsx`

---

## 7. State Management (`lib/*-store.tsx`)

Each role-specific store uses **React Context + localStorage**, no third-party state library yet. Stores hydrate on first client render and persist on every mutation.

### Patient store ([lib/patient-store.tsx](frontend/lib/patient-store.tsx))
- Storage key: `hs_patient_store_v2`
- Slices: profile, appointments, records, documents, consents, messages, notifications, prescriptions, security (MFA, sessions), **family**, **emergencyContact**, **insurance**, **vaccinations**
- New actions (v2): `addFamilyMember`, `updateFamilyMember`, `removeFamilyMember`, `updateEmergencyContact`, `addInsurancePlan`, `updateInsurancePlan`, `removeInsurancePlan`, `markPrimaryInsurance`, `addVaccination`, `updateVaccination`, `removeVaccination`
- Hydrated demo data: 2 family members, full emergency contact block, 2 insurance plans, 5 vaccinations

### Clinician store ([lib/clinician-store.tsx](frontend/lib/clinician-store.tsx))
- Storage key: `hs_clinician_store_v3`
- Slices: `assignedPatients`, `appointments`, `notes`, `prescriptions`, `documents`, `scheduleTemplate`, `blockedSlots`, `tasks`, `notifications`, `messageDrafts`, `accessRequests`, `profile`
- Sensitive-access approval workflow: `requestAccess`, `simulateApprovalDecision`, `revokeExpiredAccess`
- Helpers: `hasEffectiveConsent`, `activeApprovedRequest`, `pendingRequest`, `patientHasConsent`
- Expiry sweep: every 30s the provider checks `accessRequests` and demotes expired approvals to `"expired"`

### Admin store ([lib/admin-store.tsx](frontend/lib/admin-store.tsx))
- Storage key: `hs_admin_store_v2`
- Slices: `organization`, `staff`, `patients`, `departments`, `assignments`, `auditLedger`, `notifications`, `onboardingChecklist`, retention defaults, password policy
- Seed patient IDs align with `app/admin/patients/patients-data.ts` slugs (`aarav-mehta`, `neha-bansal`, `vikram-rao`)

---

## 8. Authentication & Security

- **Session:** JWT (HS256) via `jose` in [lib/auth.ts](frontend/lib/auth.ts) — 12-hour TTL
- **Cookie:** httpOnly, Secure, SameSite=Strict (in production)
- **Demo users:** [lib/demo-users.ts](frontend/lib/demo-users.ts) — one account per role
- **API stubs:** `app/api/auth/*` — login, logout, register, verify-email, verify-otp, resend-otp (mocked, no backend)
- **Middleware ([middleware.ts](frontend/middleware.ts)):** redirects unauthenticated users to role-appropriate login (`/login`, `/staff-login`, `/super-login`) with `?next=` preserved
- **Security headers ([next.config.ts](frontend/next.config.ts)):** X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS, X-DNS-Prefetch-Control
- **MFA:** mandatory for staff/admin/compliance/auditor/super; optional for patients
- **Audit toasts:** every destructive action surfaces "audit-logged" message via `sonner`

---

## 9. Known Gaps & Open Items

### Confirmed missing (cross-cutting, not pages)

- ❌ `components/ui/skeleton.tsx` — loading skeleton component
- ❌ First-time onboarding tour for clinician + admin
- ❌ Help / docs drawer in `role-header.tsx`
- ❌ Masked-field component with click-to-reveal + audit toast
- ❌ Patient-initiated deletion request submission form
- ❌ i18n scaffolding
- ❌ WCAG 2.1 AA accessibility audit pass
- ❌ CSRF token mechanism (needed before backend wiring)
- ❌ Content Security Policy header (deferred — needs nonce wiring for Tailwind v4)

### Demo-only quirks to remember

- All stores persist seeded PHI to **localStorage** — acceptable for demo only; must be removed once real APIs land (requirement doc Sec 5.5)
- Compliance and Super sides use **hardcoded mock data**, not a store
- `/clinician/appointments` index was added to fix a 404; the requirement doc only mandates `/clinician/appointments/[id]`
- `/checkout` exists for the marketing flow but billing is officially out of Phase 1 scope

---

## 10. Build & Verify

```powershell
cd d:/helathsecure/frontend
npm install
npm run dev          # localhost:3000
npm run build        # production build (must exit 0)
npm run lint         # 0 warnings expected
npx tsc --noEmit     # 0 errors expected
npm audit            # 0 vulnerabilities expected
```

Dev login (any role): credentials in [lib/demo-users.ts](frontend/lib/demo-users.ts). Common demo password: `Demo!Pass1234`.

---

## 11. Conventions to Follow

- **No emojis in code** unless the user explicitly asks.
- **No documentation files (`*.md`) created** unless the user asks — only `CLAUDE.md` + `KNOWLEDGE.md` are auto-managed.
- **Edit existing files** before creating new ones.
- **Comments:** none by default; only the rare "why" for a non-obvious invariant.
- **Type-strictness:** `tsconfig.json` has strict mode on — all new code must satisfy it.
- **Tailwind v4 + design tokens:** use `var(--color-foreground)` etc. from `app/globals.css`, never raw hex.
- **`<Suspense>` for `useSearchParams`:** every client component that reads search params must be wrapped in `<Suspense>` or Next 15 build fails (already enforced on existing pages).
- **Security badges:** any new PHI surface should render a `<SecurityBadge>` (encrypted / consent-bound / audited).
- **Action confirms:** any destructive UI action should use `<ActionButton confirm={...}>` for the modal + toast pattern.

---

## 12. Changelog

> Newest entry on top. Format: `YYYY-MM-DD HH:MM - [ADDED/REMOVED/MODIFIED] - what changed and why`

2026-05-27 14:15 - [MODIFIED] - Patient sidebar entries removed: Family, Emergency info, Insurance, Vaccinations. The 4 module pages were refactored — body extracted into reusable `*-manager.tsx` files (`family/family-manager.tsx`, `emergency/emergency-manager.tsx`, `insurance/insurance-manager.tsx`, `vaccinations/vaccinations-manager.tsx`), and `page.tsx` files reduced to thin PageHeader wrappers. Settings → Personal information now renders the 4 managers in a nested Tabs UI (Family / Emergency / Insurance / Vaccinations) instead of summary cards. Dedicated `/patient/{family,emergency,insurance,vaccinations}` routes remain for direct URL access. Why: consolidate "personal info" navigation into Settings per user request, freeing up sidebar real estate.
2026-05-27 13:45 - [ADDED] - `app/patient/settings/page.tsx` gained a new **"Personal information"** tab (between Profile and Security) that consolidates Family / Emergency / Insurance / Vaccinations into 4 summary cards. Each card shows live stat counts + the first 3 records + a "Manage in full view" link to the dedicated page. Settings is now the discovery surface; the 4 dedicated pages remain for deep edits.
2026-05-27 13:30 - [ADDED] - Patient sidebar gained a new "Personal" section grouping the 3 account-personal items (family, emergency, insurance); "Vaccinations" added under Workspace. Both desktop sidebar (`components/patient/sidebar.tsx`) and mobile/search header (`components/patient/header.tsx`) updated in sync.
2026-05-27 13:25 - [ADDED] - `app/patient/vaccinations/page.tsx` — vaccination history with stats (total, doses this year, travel count, next due), filter tabs (All / Routine / Travel / Upcoming), search, add/edit dialog with common-Indian-vaccine combobox, certificate-download mock, upcoming-dose reminder banner (<30 days). Per requirement #11.
2026-05-27 13:20 - [ADDED] - `app/patient/insurance/page.tsx` — multi-plan management with stats (active plans, primary, claims, next renewal), policy-number auto-masking on save, primary-plan flag with auto-promotion on remove, pre-authorization status chips, optional card image upload (filename only for demo), renewal warning banner. Per requirement #10.
2026-05-27 13:15 - [ADDED] - `app/patient/emergency/page.tsx` — ER-visible emergency information panel: primary + secondary contacts, blood group, organ-donor flag, preferred hospital, allergy + critical-medication chip lists, dynamic medical-IDs list. Read-only by default with Edit/Save toggle. Per requirement #9.
2026-05-27 13:10 - [ADDED] - `app/patient/family/page.tsx` — manage family members and authorised caregivers with stats (total, minors, caregivers, last added), relationship/minor/caregiver badges, add/edit dialog, remove with confirm. Per requirement #8.
2026-05-27 13:05 - [MODIFIED] - `lib/patient-store.tsx` — extended with 4 new slices (`family`, `emergencyContact`, `insurance`, `vaccinations`) + 11 new actions + seed data. Storage key bumped to `hs_patient_store_v2`.
2026-05-27 12:30 - [ADDED] - Created CLAUDE.md + KNOWLEDGE.md at project root per session-rule setup. KNOWLEDGE.md scanned and documented all current modules, stores, shared components, known gaps, and conventions.
2026-05-27 11:55 - [MODIFIED] - `components/shared/role-header.tsx` notification bell converted from `<button>` no-op to `<Link href={notificationsHref}>`; added required `notificationsHref` prop and wired it from all 5 role layouts (admin, clinician, compliance, auditor, super) so the bell now navigates to each role's `/notifications` page.
2026-05-27 11:40 - [ADDED] - `app/(auth)/account-locked/page.tsx` — lockout screen with live MM:SS countdown, reason chip, reset-password CTA, audit-event explainer. Honors `?email=`, `?unlocksAt=`, `?reason=` query params.
2026-05-27 11:25 - [ADDED] - `app/clinician/patients/[id]/timeline/page.tsx` — dedicated chronological clinical-events view with kind filter, range tabs, day grouping; pulls assignments, appointments, notes, prescriptions, documents, and access-request events.
2026-05-27 11:00 - [ADDED] - `app/clinician/appointments/page.tsx` — encounter queue index (today/upcoming/past/all tabs, status filter, search, sortable rows linking to detail).
2026-05-27 10:45 - [ADDED] - `app/clinician/appointments/[id]/page.tsx` — single-encounter detail with lifecycle stepper, related notes/Rx blocks, patient identity card.
2026-05-27 10:30 - [ADDED] - `app/clinician/patients/[id]/documents/page.tsx` — patient-scoped documents page (upload, virus-scan badge, category filter, signed-download toast). Discovery link added in chart's Documents tab.
2026-05-27 10:15 - [ADDED] - `app/clinician/patients/[id]/records/new/page.tsx` — thin redirect to `/clinician/notes/new?patient=<id>` (keeps single source of truth for the note editor).
2026-05-27 10:00 - [ADDED] - `app/clinician/patients/[id]/records/page.tsx` — dedicated records view with template/status filters, stats, consent gating + request-access dialog reuse. Discovery link added in chart's Records tab.
2026-05-27 09:45 - [MODIFIED] - Fixed admin patient roster 404 — admin-store seed IDs changed from `pt_aarav`/`pt_neha`/`pt_vikram` to slug IDs (`aarav-mehta` etc.) so they match the static `PATIENTS` array used by the `[id]` detail page. Storage key bumped to `hs_admin_store_v2`.
2026-05-27 09:30 - [MODIFIED] - 10 pages wrapped in `<Suspense>` around `useSearchParams` so `next build` passes static prerender (clinician/patient messages views, mfa-prompt, mfa-recovery-codes, checkout, audit-logs, clinician/notes/new, patient/records).
2026-05-27 09:00 - [ADDED] - Sensitive-access approval walkthrough: extended clinician store with `AccessRequest` slice, `requestAccess` / `simulateApprovalDecision` / `revokeExpiredAccess` actions, `hasEffectiveConsent` helper. Added `RequestAccessDialog` component and wired pending/approved banners + countdown into the patient chart page.
2026-05-27 08:45 - [MODIFIED] - Security pass — bumped `postcss` to 8.5.15 via `overrides`, drove `npm audit` to 0 vulnerabilities, scaffolded `.eslintrc.json`, fixed 5 rules-of-hooks/unescaped-entities lint errors, converted Google Fonts to `next/font/google` (self-hosted Inter + JetBrains Mono).
