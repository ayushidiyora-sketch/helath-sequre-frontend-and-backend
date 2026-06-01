import { RoleKind } from "@prisma/client";

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleKind;
  organizationId: string | null;
  sessionId: string;
}

declare module "express" {
  interface Request {
    user?: JwtPayload;
  }
}
