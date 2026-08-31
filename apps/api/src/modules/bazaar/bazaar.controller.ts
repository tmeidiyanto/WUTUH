import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { Public } from '../../platform/auth/public.decorator';
import { BazaarService } from './bazaar.service';
import { BazaarQueryDto, CreateBazaarOrderDto } from './dto/bazaar.dto';

/** Pasar WUTUH — seluruh endpoint publik (etalase bisa dibuka tanpa login). */
@Public()
@Controller('bazaar')
export class BazaarController {
  constructor(private readonly svc: BazaarService) {}

  @Get('listings')
  list(@Query() q: BazaarQueryDto) {
    return this.svc.list(q);
  }

  @Get('listings/:id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.detail(id);
  }

  @Post('orders')
  createOrder(@Body() dto: CreateBazaarOrderDto) {
    return this.svc.createOrder(dto);
  }
}
