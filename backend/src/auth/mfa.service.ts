import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomInt } from "crypto";
import { RoleKind, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";

const DEFAULT_REQUIRED_ROLES: RoleKind[] = [
  "super_admin",
  "org_admin",
  "compliance_manager",
  "auditor",
  "clinician",
];

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly requiredRoles: Set<RoleKind>;
  private readonly otpLength: number;
  private readonly ttlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    const raw = this.config.get<string>("MFA_REQUIRED_ROLES");
    const roles = raw
      ? raw.split(",").map((s) => s.trim() as RoleKind).filter(Boolean)
      : DEFAULT_REQUIRED_ROLES;
    this.requiredRoles = new Set(roles);
    this.otpLength = Math.max(4, Math.min(10, Number(this.config.get<string>("OTP_LENGTH") ?? 6)));
    this.ttlMs = Math.max(60, Number(this.config.get<string>("OTP_TTL_SECONDS") ?? 300)) * 1000;
  }

  requiresMfa(role: RoleKind): boolean {
    return this.requiredRoles.has(role);
  }

  /** Issue a fresh OTP challenge for `user`, emailing the code.
   *  Returns the challenge id (no code) — the code only leaves via email. */
  async issueChallenge(
    user: Pick<User, "id" | "email" | "firstName">,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ challengeId: string; expiresAt: Date }> {
    const code = this.generateCode();
    const codeHash = this.hashCode(code);
    const expiresAt = new Date(Date.now() + this.ttlMs);

    // Revoke any prior un-used challenges for this user — fresh login restarts the clock.
    await this.prisma.mfaChallenge.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date(), attemptsLeft: 0 },
    });

    const challenge = await this.prisma.mfaChallenge.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    const ttlMin = Math.round(this.ttlMs / 60_000);
    await this.mail.send({
      to: user.email,
      subject: `Your HealthSecure sign-in code: ${code}`,
      text: `Hi ${user.firstName},

Your one-time sign-in code is:

    ${code}

It expires in ${ttlMin} minutes. If you didn't try to sign in, ignore this message and change your password — the attempt was logged at ${new Date().toUTCString()}.

— HealthSecure Portal security`,
      html: `<p>Hi ${escapeHtml(user.firstName)},</p>
<p>Your one-time sign-in code is:</p>
<p style="font-family: ui-monospace, Menlo, monospace; font-size: 28px; letter-spacing: 6px; padding: 12px 18px; background: #f3f4f6; border-radius: 10px; display: inline-block;">${code}</p>
<p>It expires in ${ttlMin} minutes.</p>
<p style="color:#6b7280; font-size: 12px;">If you didn't try to sign in, ignore this message and change your password. The attempt was logged at ${new Date().toUTCString()}.</p>
<p style="color:#6b7280; font-size: 12px;">— HealthSecure Portal security</p>`,
    });

    this.logger.log(`Issued MFA challenge ${challenge.id} for user ${user.id}`);
    return { challengeId: challenge.id, expiresAt };
  }

  /** Verify a `code` for `challengeId`. Throws if expired/used/attempts-exhausted/wrong code. */
  async verifyChallenge(challengeId: string, code: string): Promise<{ userId: string }> {
    const challenge = await this.prisma.mfaChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new BadRequestException("Unknown challenge");

    if (challenge.usedAt) throw new BadRequestException("Code already used");
    if (challenge.expiresAt < new Date()) throw new BadRequestException("Code expired");
    if (challenge.attemptsLeft <= 0) throw new BadRequestException("Attempts exhausted — restart login");

    const expected = challenge.codeHash;
    const actual = this.hashCode(code.trim());
    if (expected !== actual) {
      const nextAttempts = challenge.attemptsLeft - 1;
      await this.prisma.mfaChallenge.update({
        where: { id: challengeId },
        data: { attemptsLeft: nextAttempts },
      });
      throw new UnauthorizedException(
        `Wrong code · ${nextAttempts} attempt${nextAttempts === 1 ? "" : "s"} left`,
      );
    }

    await this.prisma.mfaChallenge.update({
      where: { id: challengeId },
      data: { usedAt: new Date(), attemptsLeft: 0 },
    });

    return { userId: challenge.userId };
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private generateCode(): string {
    // Cryptographically random N-digit code, zero-padded.
    const max = 10 ** this.otpLength;
    return String(randomInt(0, max)).padStart(this.otpLength, "0");
  }

  private hashCode(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" :
    c === "<" ? "&lt;" :
    c === ">" ? "&gt;" :
    c === "\"" ? "&quot;" : "&#39;",
  );
}
