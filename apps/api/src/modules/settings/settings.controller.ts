import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { SettingsService } from './settings.service';
import { TestChannelDto, UpdatePaymentDto, UpsertChannelDto } from './dto/settings.dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get('channels')
  @RequirePermissions('settings.read')
  listChannels() {
    return this.svc.listChannels();
  }

  @Put('channels/:channel')
  @RequirePermissions('settings.write')
  upsertChannel(@Param('channel') channel: string, @Body() dto: UpsertChannelDto) {
    return this.svc.upsertChannel(channel, dto);
  }

  @Post('channels/:channel/test')
  @RequirePermissions('settings.write')
  testChannel(@Param('channel') channel: string, @Body() dto: TestChannelDto) {
    return this.svc.testChannel(channel, dto);
  }

  @Get('payment')
  @RequirePermissions('settings.read')
  getPayment() {
    return this.svc.getPayment();
  }

  @Put('payment')
  @RequirePermissions('settings.write')
  updatePayment(@Body() dto: UpdatePaymentDto) {
    return this.svc.updatePayment(dto);
  }
}
