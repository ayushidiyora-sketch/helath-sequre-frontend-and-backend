import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { JwtAuthGuard } from "./jwt.guard";
import { RoleGuard } from "./role.guard";
import { MfaService } from "./mfa.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("AUTH_SECRET"),
        signOptions: {
          algorithm: "HS256",
          expiresIn: Number(config.get<string>("JWT_TTL_SECONDS") ?? 43200),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, MfaService, JwtAuthGuard, RoleGuard],
  exports: [AuthService, MfaService, JwtAuthGuard, RoleGuard, JwtModule],
})
export class AuthModule {}
