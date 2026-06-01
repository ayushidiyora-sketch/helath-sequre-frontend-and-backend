import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { TenantTier, TenantType } from "@prisma/client";

export class CreateTenantDto {
  /** Org slug used in cross-tenant URLs (e.g., org_lakeside). */
  @IsString()
  @MinLength(3)
  @MaxLength(40)
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: "slug must start with a lowercase letter and contain only [a-z0-9_]",
  })
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEnum(TenantType)
  type!: TenantType;

  @IsEnum(TenantTier)
  @IsOptional()
  tier?: TenantTier;

  @IsString()
  @IsOptional()
  region?: string;

  @IsBoolean()
  @IsOptional()
  multiAzEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  crossRegionS3?: boolean;

  /** Email of the first Org Admin to invite (a user row is created, no
   *  password — they accept via signed invitation token in a later phase). */
  @IsEmail()
  firstAdminEmail!: string;
}
