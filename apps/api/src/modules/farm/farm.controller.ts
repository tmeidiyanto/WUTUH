import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { FarmService } from './farm.service';
import {
  AdvanceStageDto,
  CreateActivityDto,
  CreateCycleDto,
  CreateHarvestDto,
  UpdateCycleDto,
} from './dto/farm.dto';

@Controller('cycles')
export class FarmController {
  constructor(private readonly svc: FarmService) {}

  @Get()
  @RequirePermissions('farm.read')
  list(@Query('category') category?: string) {
    return this.svc.list(category);
  }

  @Get(':id')
  @RequirePermissions('farm.read')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.detail(id);
  }

  @Get(':id/trace')
  @RequirePermissions('farm.read')
  trace(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.trace(id);
  }

  @Post(':id/share')
  @RequirePermissions('farm.read')
  share(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.share(id);
  }

  @Post()
  @RequirePermissions('farm.write')
  create(@Body() dto: CreateCycleDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('farm.write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCycleDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/advance')
  @RequirePermissions('farm.write')
  advance(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdvanceStageDto) {
    return this.svc.advance(id, dto);
  }

  @Post(':id/activities')
  @RequirePermissions('farm.write')
  addActivity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateActivityDto) {
    return this.svc.addActivity(id, dto);
  }

  @Post(':id/harvests')
  @RequirePermissions('farm.write')
  addHarvest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateHarvestDto) {
    return this.svc.addHarvest(id, dto);
  }
}
