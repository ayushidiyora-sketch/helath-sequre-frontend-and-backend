# HealthSecure Portal — Backend

NestJS + Prisma + PostgreSQL. First slice covers Super Admin auth + tenants
provisioning. See `../KNOWLEDGE.md` for the project-wide picture.

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ running locally (you've got 17 in pgAdmin — perfect)
- A `helath_secure` database created in your PostgreSQL instance

## First-time setup

1. **Create the database**. In pgAdmin, right-click `Databases` →
   `Create` → `Database…` → name it `helath_secure` → Save.
   Or via psql:
   ```sh
   psql -U postgres -c "CREATE DATABASE helath_secure;"
   ```

2. **Copy env file and fill in credentials**:
   ```sh
   cp .env.example .env
   # then edit .env and replace CHANGE_ME values
   ```
   Set `DATABASE_URL` to point at your `helath_secure` DB.
   Set `AUTH_SECRET` to a long random string. **Use the same value in the
   frontend's `.env.local` if you want shared sessions later.**

3. **Install dependencies**:
   ```sh
   npm install
   ```

4. **Generate Prisma client + run the first migration**:
   ```sh
   npm run prisma:migrate -- --name init
   ```
   This creates the tables and writes a migration file under `prisma/migrations/`.

5. **Seed a Super Admin user + permission catalog**:
   ```sh
   npm run prisma:seed
   ```
   Default credentials from `.env`:
   - email: `riya.sen@sensussoft.com`
   - password: `Demo!Pass1234`

6. **Start the dev server**:
   ```sh
   npm run dev
   ```
   API now listens on `http://localhost:3001/api/v1`.

## Smoke test

Staff roles (super_admin / org_admin / compliance_manager / auditor / clinician)
go through a two-step email-OTP flow. The first call returns a challenge
id, NOT tokens. The frontend then prompts for the 6-digit code and posts
to `/auth/mfa/verify`.

```sh
# 1a. Submit credentials
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ayushi.diyora@sensussoft.com","password":"Demo!Pass1234"}'
# Returns { mfaRequired: true, challengeId: "...", emailHint: "ay•••@sensussoft.com", expiresAt: ... }
# The 6-digit OTP is emailed (or printed to console if SMTP is not configured).

# 1b. Verify the OTP
curl -X POST http://localhost:3001/api/v1/auth/mfa/verify \
  -H "Content-Type: application/json" \
  -d '{"challengeId":"...","code":"123456"}'
# Returns { accessToken, refreshToken, sessionId, user: {...} }

# 2. List tenants (initially empty)
curl http://localhost:3001/api/v1/super/tenants \
  -H "Authorization: Bearer <accessToken from step 1>"

# 3. Provision a new tenant
curl -X POST http://localhost:3001/api/v1/super/tenants \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "org_lakeside",
    "name": "Lakeside Pediatric Clinic",
    "type": "clinic",
    "tier": "basic",
    "region": "ap-south-1",
    "firstAdminEmail": "admin@lakesidepeds.org"
  }'
```

The provision response includes a one-time `temporaryPassword` for the
first Org Admin. In production this would be replaced by a signed
invitation token via SendGrid.

## Project structure

```
backend/
├── prisma/
│   ├── schema.prisma         ← entity model
│   ├── seed.ts               ← permission catalog + super admin user
│   └── migrations/           ← Prisma-generated (after first migrate)
├── src/
│   ├── main.ts               ← Nest bootstrap (port, CORS, validation, helmet)
│   ├── app.module.ts
│   ├── prisma/               ← global PrismaService
│   ├── auth/                 ← login / refresh / logout / me  + JwtAuthGuard, RoleGuard
│   └── super/
│       └── tenants/          ← GET / POST / PATCH / DELETE /super/tenants
├── package.json
├── tsconfig.json
├── nest-cli.json
└── .env.example
```

## Auth model

- **Two-step login for staff roles**: email + password → 6-digit OTP
  emailed to user → POST `/auth/mfa/verify` with `{ challengeId, code }`
  → tokens. Roles requiring OTP: `super_admin`, `org_admin`,
  `compliance_manager`, `auditor`, `clinician`. Patients skip MFA (single
  step).
- **OTP**: 6 digits, 5-minute TTL, SHA-256 hashed in DB, single-use,
  5 attempts max. Configurable via `OTP_LENGTH`, `OTP_TTL_SECONDS`,
  `MFA_REQUIRED_ROLES` in `.env`.
- **Email**: nodemailer via Gmail SMTP (or any SMTP). Set `SMTP_HOST`,
  `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` in `.env`. If left
  blank, the server **logs the email to the console** as a dev fallback.
- **Access token**: signed JWT (HS256), 12-hour TTL by default. Carry as
  `Authorization: Bearer <token>`.
- **Refresh token**: opaque random string, rotated on every use, SHA-256
  hashed in the `sessions` table. Send via `POST /auth/refresh` with
  `{ sessionId, refreshToken }` to mint a fresh access token.
- **Lockout**: 5 failed password logins → 15-minute lockout (per HIPAA
  Sec 10.2).
- **Logout**: `POST /auth/logout` revokes the current session.

### Configuring Gmail SMTP (so the OTP arrives in your inbox)

1. Turn on 2-Step Verification on your Google account
   (https://myaccount.google.com/security)
2. Generate an App Password at https://myaccount.google.com/apppasswords
   — pick "Mail" + any device label, copy the 16-character password.
3. Edit `.env`:
   ```
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT=587
   SMTP_USER="your-gmail@gmail.com"
   SMTP_PASS="xxxxxxxxxxxxxxxx"  # 16-char, no spaces
   SMTP_FROM="HealthSecure Portal <your-gmail@gmail.com>"
   ```
4. Restart the dev server (`npm run dev`). On startup you should see
   `SMTP transport ready (smtp.gmail.com:587 as your-gmail@gmail.com)`.

## RBAC

Every controller can declare `@Roles(...)` (see `auth/role.guard.ts`).
The `JwtAuthGuard + RoleGuard` pair is applied to the entire
`super/tenants` controller — only `super_admin` users can hit those
endpoints.

## Next slices (not in this scope)

- Org Admin module: users, departments, settings, branding
- Compliance Manager: audit-logs query, consent policies, anomalies
- Patient + Clinician modules: records, appointments, documents, messages
- MFA enrollment + challenge endpoints
- Audit ledger (append-only, hash-chained per Sec 11)
- File uploads via S3 presigned URLs
