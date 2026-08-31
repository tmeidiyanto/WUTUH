import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { TradeService } from './trade.service';
import { CreateDealDto, CreatePartnerDto, UpdateDealDto, UpdatePartnerDto } from './dto/trade.dto';

@Controller()
export class TradeController {
  constructor(private readonly svc: TradeService) {}

  @Get('partners')
  @RequirePermissions('trade.read')
  listPartners() {
    return this.svc.listPartners();
  }

  @Post('partners')
  @RequirePermissions('trade.write')
  createPartner(@Body() dto: CreatePartnerDto) {
    return this.svc.createPartner(dto);
  }

  @Patch('partners/:id')
  @RequirePermissions('trade.write')
  updatePartner(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerDto) {
    return this.svc.updatePartner(id, dto);
  }

  @Get('deals')
  @RequirePermissions('trade.read')
  listDeals() {
    return this.svc.listDeals();
  }

  @Post('deals')
  @RequirePermissions('trade.write')
  createDeal(@Body() dto: CreateDealDto) {
    return this.svc.createDeal(dto);
  }

  @Patch('deals/:id')
  @RequirePermissions('trade.write')
  updateDeal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDealDto) {
    return this.svc.updateDeal(id, dto);
  }
}
