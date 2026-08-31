import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { MasterService } from './master.service';
import { CreateCommodityDto, CreateLandDto, UpdateCommodityDto, UpdateLandDto } from './dto/master.dto';

@Controller()
export class MasterController {
  constructor(private readonly svc: MasterService) {}

  // ---- Lahan ----
  @Get('lands')
  @RequirePermissions('master.read')
  listLands() {
    return this.svc.listLands();
  }

  @Post('lands')
  @RequirePermissions('master.write')
  createLand(@Body() dto: CreateLandDto) {
    return this.svc.createLand(dto);
  }

  @Patch('lands/:id')
  @RequirePermissions('master.write')
  updateLand(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLandDto) {
    return this.svc.updateLand(id, dto);
  }

  // ---- Komoditas ----
  @Get('commodities')
  @RequirePermissions('master.read')
  listCommodities() {
    return this.svc.listCommodities();
  }

  @Post('commodities')
  @RequirePermissions('master.write')
  createCommodity(@Body() dto: CreateCommodityDto) {
    return this.svc.createCommodity(dto);
  }

  @Patch('commodities/:id')
  @RequirePermissions('master.write')
  updateCommodity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCommodityDto) {
    return this.svc.updateCommodity(id, dto);
  }
}
