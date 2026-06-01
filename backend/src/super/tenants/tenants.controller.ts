import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { RoleKind } from "@prisma/client";
import { JwtAuthGuard } from "../../auth/jwt.guard";
import { RoleGuard, Roles } from "../../auth/role.guard";
import { TenantsService } from "./tenants.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";

@Controller("super/tenants")
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(RoleKind.super_admin)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  list() {
    return this.tenants.list();
  }

  @Get(":id")
  get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.tenants.get(id);
  }

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateTenantDto) {
    return this.tenants.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenants.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  async archive(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    await this.tenants.archive(id);
  }
}
