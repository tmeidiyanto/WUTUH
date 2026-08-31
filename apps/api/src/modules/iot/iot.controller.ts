import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../../platform/auth/public.decorator';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { IotService } from './iot.service';
import { CreateDeviceDto, IngestDto, UpdateDeviceDto } from './dto/iot.dto';

@Controller('iot')
export class IotController {
  constructor(private readonly svc: IotService) {}

  @Get('devices')
  @RequirePermissions('iot.read')
  list() {
    return this.svc.list();
  }

  @Post('devices')
  @RequirePermissions('iot.write')
  create(@Body() dto: CreateDeviceDto) {
    return this.svc.create(dto);
  }

  @Patch('devices/:id')
  @RequirePermissions('iot.write')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeviceDto) {
    return this.svc.update(id, dto);
  }

  @Get('devices/:id/readings')
  @RequirePermissions('iot.read')
  readings(@Param('id', ParseUUIDPipe) id: string, @Query('hours') hours?: string) {
    return this.svc.readings(id, hours ? Number(hours) : 48);
  }

  /** Dipanggil perangkat IoT dari lapangan (tanpa login). */
  @Public()
  @Post('ingest')
  ingest(@Body() dto: IngestDto) {
    return this.svc.ingest(dto);
  }
}
