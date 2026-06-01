/**
 * Idempotent seed:
 *   - upserts the system permission catalog
 *   - upserts a system `super_admin` Role and grants it `platform:configure`
 *   - upserts ONE super admin user from env (SEED_SUPER_ADMIN_EMAIL/PASSWORD)
 *
 * Run with: npm run prisma:seed
 */
import * as bcrypt from "bcrypt";
import { config as loadEnv } from "dotenv";
import { PrismaClient, RoleKind, UserStatus } from "@prisma/client";

loadEnv();

const prisma = new PrismaClient();

interface PermSeed {
  code: string;
  module: string;
  description: string;
}

const PERMISSIONS: PermSeed[] = [
  // Records
  { code: "records:read", module: "records", description: "Read medical records (consent-evaluated)" },
  { code: "records:write", module: "records", description: "Create or update medical records" },
  { code: "records:finalize", module: "records", description: "Finalize/lock a clinical note" },
  // Appointments
  { code: "appointments:manage", module: "appointments", description: "Create/update/cancel appointments" },
  // Documents
  { code: "documents:upload", module: "documents", description: "Upload patient documents" },
  { code: "documents:download", module: "documents", description: "Download patient documents (consent-evaluated)" },
  // Messages
  { code: "messages:send", module: "messages", description: "Send secure messages" },
  // Consent
  { code: "consents:grant", module: "consents", description: "Grant consent (patient self-action)" },
  { code: "consents:revoke", module: "consents", description: "Revoke consent (patient self-action)" },
  // Users / org
  { code: "users:manage", module: "users", description: "Manage users within an organization" },
  { code: "org:configure", module: "org", description: "Modify organization-level settings" },
  // Audit & reports
  { code: "audit:read", module: "audit", description: "Read audit logs" },
  { code: "reports:export", module: "reports", description: "Export reports (PDF/CSV)" },
  // Super admin
  { code: "platform:configure", module: "platform", description: "Modify platform-level settings (super admin only)" },
  { code: "tenants:provision", module: "platform", description: "Create / archive tenants" },
  { code: "breakglass:initiate", module: "platform", description: "Initiate cross-tenant break-glass" },
];

async function main(): Promise<void> {
  console.log("[seed] upserting permissions...");
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: { module: p.module, description: p.description },
      create: p,
    });
  }

  console.log("[seed] upserting system super_admin role...");
  // System role: organizationId = null
  let superRole = await prisma.role.findFirst({
    where: { organizationId: null, kind: RoleKind.super_admin },
  });
  if (!superRole) {
    superRole = await prisma.role.create({
      data: {
        organizationId: null,
        kind: RoleKind.super_admin,
        name: "Super Admin",
        description: "Sensussoft platform operator. Cross-tenant scope; PHI-blind by default.",
      },
    });
  }

  // Grant the platform-tier permissions to the super_admin role.
  const platformPerms = await prisma.permission.findMany({
    where: { module: "platform" },
  });
  for (const perm of platformPerms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: superRole.id, permissionId: perm.id },
    });
  }

  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? "riya.sen@sensussoft.com";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "Demo!Pass1234";
  console.log(`[seed] upserting super admin ${email}...`);
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {
      // Don't clobber an existing password on re-seed.
      roleKind: RoleKind.super_admin,
      roleId: superRole.id,
      status: UserStatus.active,
    },
    create: {
      email,
      passwordHash,
      firstName: "Riya",
      lastName: "Sen",
      roleKind: RoleKind.super_admin,
      roleId: superRole.id,
      status: UserStatus.active,
    },
  });

  console.log("[seed] done. You can now POST /api/v1/auth/login with that email + password.");
}

main()
  .catch((err) => {
    console.error("[seed] failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
