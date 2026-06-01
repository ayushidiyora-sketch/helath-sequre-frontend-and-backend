import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { createHash, randomBytes } from "crypto";
import { RoleKind, User, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MfaService } from "./mfa.service";
import { JwtPayload } from "./jwt-payload";

const REFRESH_TTL_DAYS = 7;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: RoleKind;
    organizationId: string | null;
  };
}

export interface MfaRequired {
  mfaRequired: true;
  challengeId: string;
  /** Masked email so the UI can hint where the code was sent. */
  emailHint: string;
  expiresAt: Date;
}

export type LoginResult = AuthTokens | MfaRequired;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mfa: MfaService,
    private readonly config: ConfigService,
  ) {}

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid email or password");

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException("Account is temporarily locked");
    }

    if (user.status !== UserStatus.active) {
      throw new ForbiddenException(`Account is ${user.status}`);
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const nextCount = user.failedLoginCount + 1;
      const lockedUntil =
        nextCount >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : null;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginCount: nextCount, lockedUntil },
      });
      if (lockedUntil) {
        throw new ForbiddenException(
          `Account locked for ${LOCKOUT_MINUTES} minutes due to too many failed attempts`,
        );
      }
      throw new UnauthorizedException("Invalid email or password");
    }

    // Password is good. Reset failed counter; lastLoginAt is set after MFA completes.
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    // Staff roles need OTP — issue a challenge and stop here.
    if (this.mfa.requiresMfa(user.roleKind)) {
      const { challengeId, expiresAt } = await this.mfa.issueChallenge(
        user,
        ipAddress,
        userAgent,
      );
      return {
        mfaRequired: true,
        challengeId,
        emailHint: maskEmail(user.email),
        expiresAt,
      };
    }

    // Patient (or any role not in MFA list): issue tokens directly.
    return this.issueTokens(user, ipAddress, userAgent);
  }

  /** Called after the user submits the OTP. */
  async completeMfa(
    challengeId: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const { userId } = await this.mfa.verifyChallenge(challengeId, code);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    if (user.status !== UserStatus.active) {
      throw new ForbiddenException(`Account is ${user.status}`);
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueTokens(user, ipAddress, userAgent);
  }

  async refresh(sessionId: string, refreshToken: string): Promise<AuthTokens> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException("Session not found");
    if (session.revokedAt) throw new UnauthorizedException("Session revoked");
    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired");
    }

    const hash = this.hashToken(refreshToken);
    if (hash !== session.refreshTokenHash) {
      // Token mismatch — treat as compromise: revoke this session.
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Refresh token mismatch — session revoked");
    }

    // Rotate: revoke old session, mint a new one.
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(session.user, session.ipAddress ?? undefined, session.userAgent ?? undefined);
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session
      .update({
        where: { id: sessionId },
        data: { revokedAt: new Date() },
      })
      .catch(() => {
        /* idempotent — already revoked or removed */
      });
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        roleKind: true,
        organizationId: true,
        lastLoginAt: true,
        organization: { select: { id: true, slug: true, name: true } },
      },
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async issueTokens(
    user: User,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthTokens> {
    const refreshToken = randomBytes(48).toString("base64url");
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.roleKind,
      organizationId: user.organizationId,
      sessionId: session.id,
    };

    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      refreshToken,
      sessionId: session.id,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.roleKind,
        organizationId: user.organizationId,
      },
    };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}
