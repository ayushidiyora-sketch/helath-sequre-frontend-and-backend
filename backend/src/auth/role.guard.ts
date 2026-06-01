import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { RoleKind } from "@prisma/client";

export const ROLES_KEY = "roles";

/** Decorator: `@Roles("super_admin", "org_admin")` */
export const Roles = (...roles: RoleKind[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleKind[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const role = req.user?.role;
    if (!role || !required.includes(role)) {
      throw new ForbiddenException(`Requires one of: ${required.join(", ")}`);
    }
    return true;
  }
}
