import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt.guard";
import { LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import { VerifyMfaDto } from "./dto/verify-mfa.dto";

function reqContext(req: Request): { ip?: string; ua?: string } {
  const ip =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ??
    req.socket.remoteAddress ??
    undefined;
  const ua = req.headers["user-agent"];
  return { ip, ua };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const { ip, ua } = reqContext(req);
    return this.auth.login(dto.email, dto.password, ip, ua);
  }

  @Post("mfa/verify")
  @HttpCode(200)
  async verifyMfa(@Body() dto: VerifyMfaDto, @Req() req: Request) {
    const { ip, ua } = reqContext(req);
    return this.auth.completeMfa(dto.challengeId, dto.code, ip, ua);
  }

  @Post("refresh")
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.sessionId, dto.refreshToken);
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request): Promise<void> {
    const sessionId = req.user?.sessionId;
    if (sessionId) await this.auth.logout(sessionId);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    const userId = req.user?.sub;
    if (!userId) return null;
    return this.auth.getMe(userId);
  }
}
