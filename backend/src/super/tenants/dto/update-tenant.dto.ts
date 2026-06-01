import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { TenantStatus, TenantTier } from "@prisma/client";

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsEnum(TenantTier)
  @IsOptional()
  tier?: TenantTier;

  @IsEnum(TenantStatus)
  @IsOptional()
  status?: TenantStatus;

  @IsString()
  @IsOptional()
  region?: string;

  @IsBoolean()
  @IsOptional()
  multiAzEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  crossRegionS3?: boolean;

  @IsObject()
  @IsOptional()
  settings?: Record<string, unknown>;
}
