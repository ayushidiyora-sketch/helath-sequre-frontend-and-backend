import {
  ConflictException,
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { Prisma, RoleKind, UserStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.organization.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        tier: true,
        status: true,
        region: true,
        multiAzEnabled: true,
        crossRegionS3: true,
        createdAt: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
    });
  }

  async get(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!org || org.archivedAt) throw new NotFoundException("Tenant not found");
    return org;
  }

  async create(dto: CreateTenantDto) {
    const existing = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException(`Slug "${dto.slug}" is already taken`);

    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          slug: dto.slug,
          name: dto.name,
          type: dto.type,
          tier: dto.tier ?? "basic",
          region: dto.region ?? "ap-south-1",
          multiAzEnabled: dto.multiAzEnabled ?? false,
          crossRegionS3: dto.crossRegionS3 ?? false,
        },
      });

      // Default Org Admin role for the new tenant.
      const role = await tx.role.create({
        data: {
          organizationId: org.id,
          kind: RoleKind.org_admin,
          name: "Org Admin",
          description: "Manages tenant-scoped users and configuration",
        },
      });

      // Invite the first Org Admin. We mint a random throwaway password the
      // invitee will be forced to reset on first sign-in via the existing
      // /reset-password flow.
      const tempPassword = randomBytes(16).toString("base64url");
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const admin = await tx.user.create({
        data: {
          organizationId: org.id,
          email: dto.firstAdminEmail,
          passwordHash,
          firstName: "Org",
          lastName: "Admin",
          roleKind: RoleKind.org_admin,
          roleId: role.id,
          status: UserStatus.invited,
        },
      });

      this.logger.log(
        `Provisioned tenant ${org.slug} (id=${org.id}) with first admin ${admin.email}`,
      );

      return {
        organization: org,
        firstAdmin: {
          id: admin.id,
          email: admin.email,
          status: admin.status,
        },
        /** Surfaced once so Super Admin can hand it to the invitee out-of-band.
         *  In real life: send a signed invitation token via SendGrid instead. */
        temporaryPassword: tempPassword,
      };
    });
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.get(id);
    try {
      return await this.prisma.organization.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.tier !== undefined && { tier: dto.tier }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.region !== undefined && { region: dto.region }),
          ...(dto.multiAzEnabled !== undefined && { multiAzEnabled: dto.multiAzEnabled }),
          ...(dto.crossRegionS3 !== undefined && { crossRegionS3: dto.crossRegionS3 }),
          ...(dto.settings !== undefined && {
            settings: dto.settings as Prisma.InputJsonValue,
          }),
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        throw new NotFoundException("Tenant not found");
      }
      throw err;
    }
  }

  async archive(id: string) {
    await this.get(id);
    return this.prisma.organization.update({
      where: { id },
      data: { archivedAt: new Date(), status: "archived" },
    });
  }
}
