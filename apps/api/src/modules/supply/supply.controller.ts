import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { SupplyService } from './supply.service';
import {
  AdjustStockDto,
  CreateDeliveryDto,
  CreateWarehouseDto,
  UpdateDeliveryStatusDto,
  UpdateWarehouseDto,
} from './dto/supply.dto';

@Controller()
export class SupplyController {
  constructor(private readonly svc: SupplyService) {}

  @Get('warehouses')
  @RequirePermissions('supply.read')
  listWarehouses() {
    return this.svc.listWarehouses();
  }

  @Post('warehouses')
  @RequirePermissions('supply.write')
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.svc.createWarehouse(dto);
  }

  @Patch('warehouses/:id')
  @RequirePermissions('supply.write')
  updateWarehouse(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWarehouseDto) {
    return this.svc.updateWarehouse(id, dto);
  }

  @Get('stock')
  @RequirePermissions('supply.read')
  listBalances() {
    return this.svc.listBalances();
  }

  @Get('stock/movements')
  @RequirePermissions('supply.read')
  listMovements() {
    return this.svc.listMovements();
  }

  @Post('stock/adjust')
  @RequirePermissions('supply.write')
  adjust(@Body() dto: AdjustStockDto) {
    return this.svc.adjust(dto);
  }

  @Get('deliveries')
  @RequirePermissions('supply.read')
  listDeliveries() {
    return this.svc.listDeliveries();
  }

  @Post('deliveries')
  @RequirePermissions('supply.write')
  createDelivery(@Body() dto: CreateDeliveryDto) {
    return this.svc.createDelivery(dto);
  }

  @Patch('deliveries/:id/status')
  @RequirePermissions('supply.write')
  updateDeliveryStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDeliveryStatusDto) {
    return this.svc.updateDeliveryStatus(id, dto);
  }
}
