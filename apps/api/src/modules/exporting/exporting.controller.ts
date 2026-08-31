import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { ExportingService } from './exporting.service';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/exporting.dto';

@Controller('export-shipments')
export class ExportingController {
  constructor(private readonly svc: ExportingService) {}

  @Get()
  @RequirePermissions('export.read')
  list() {
    return this.svc.list();
  }

  @Post()
  @RequirePermissions('export.write')
  create(@Body() dto: CreateShipmentDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('export.write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateShipmentDto) {
    return this.svc.update(id, dto);
  }
}
