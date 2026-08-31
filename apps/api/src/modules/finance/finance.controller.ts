import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { FinanceService } from './finance.service';
import { CreateTransactionDto } from './dto/finance.dto';

@Controller('finance')
export class FinanceController {
  constructor(private readonly svc: FinanceService) {}

  @Get('transactions')
  @RequirePermissions('finance.read')
  list(@Query('month') month?: string) {
    return this.svc.list(month);
  }

  @Post('transactions')
  @RequirePermissions('finance.write')
  create(@Body() dto: CreateTransactionDto) {
    return this.svc.create(dto);
  }

  @Delete('transactions/:id')
  @RequirePermissions('finance.write')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }

  @Get('summary')
  @RequirePermissions('finance.read')
  summary() {
    return this.svc.summary();
  }
}
