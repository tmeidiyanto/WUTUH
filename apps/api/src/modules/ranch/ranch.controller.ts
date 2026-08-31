import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { RanchService } from './ranch.service';
import {
  CreateHealthDto,
  CreateLivestockDto,
  CreateProductionDto,
  UpdateLivestockDto,
} from './dto/ranch.dto';

@Controller()
export class RanchController {
  constructor(private readonly svc: RanchService) {}

  @Get('livestock')
  @RequirePermissions('ranch.read')
  listLivestock() {
    return this.svc.listLivestock();
  }

  @Post('livestock')
  @RequirePermissions('ranch.write')
  createLivestock(@Body() dto: CreateLivestockDto) {
    return this.svc.createLivestock(dto);
  }

  @Patch('livestock/:id')
  @RequirePermissions('ranch.write')
  updateLivestock(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLivestockDto) {
    return this.svc.updateLivestock(id, dto);
  }

  @Get('livestock-production')
  @RequirePermissions('ranch.read')
  listProduction() {
    return this.svc.listProduction();
  }

  @Post('livestock-production')
  @RequirePermissions('ranch.write')
  addProduction(@Body() dto: CreateProductionDto) {
    return this.svc.addProduction(dto);
  }

  @Get('livestock-health')
  @RequirePermissions('ranch.read')
  listHealth() {
    return this.svc.listHealth();
  }

  @Post('livestock-health')
  @RequirePermissions('ranch.write')
  addHealth(@Body() dto: CreateHealthDto) {
    return this.svc.addHealth(dto);
  }
}
