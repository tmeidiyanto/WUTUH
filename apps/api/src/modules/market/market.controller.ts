import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { MarketService } from './market.service';
import {
  CreateListingDto,
  CreateOrderDto,
  CreatePriceDto,
  UpdateListingDto,
  UpdateOrderStatusDto,
  UploadPhotoDto,
} from './dto/market.dto';

@Controller('market')
export class MarketController {
  constructor(private readonly svc: MarketService) {}

  @Get('prices')
  @RequirePermissions('market.read')
  listPrices(@Query('commodityId') commodityId?: string) {
    return this.svc.listPrices(commodityId);
  }

  @Post('prices')
  @RequirePermissions('market.write')
  addPrice(@Body() dto: CreatePriceDto) {
    return this.svc.addPrice(dto);
  }

  @Get('listings')
  @RequirePermissions('market.read')
  listListings() {
    return this.svc.listListings();
  }

  @Post('listings')
  @RequirePermissions('market.write')
  createListing(@Body() dto: CreateListingDto) {
    return this.svc.createListing(dto);
  }

  @Patch('listings/:id')
  @RequirePermissions('market.write')
  updateListing(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateListingDto) {
    return this.svc.updateListing(id, dto);
  }

  @Get('listings/:id/photos')
  @RequirePermissions('market.read')
  listPhotos(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listPhotos(id);
  }

  @Post('listings/:id/photos')
  @RequirePermissions('market.write')
  addPhoto(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UploadPhotoDto) {
    return this.svc.addPhoto(id, dto.dataUrl);
  }

  @Delete('listings/:id/photos/:photoId')
  @RequirePermissions('market.write')
  deletePhoto(@Param('id', ParseUUIDPipe) id: string, @Param('photoId', ParseUUIDPipe) photoId: string) {
    return this.svc.deletePhoto(id, photoId);
  }

  @Patch('listings/:id/photos/:photoId/cover')
  @RequirePermissions('market.write')
  setCover(@Param('id', ParseUUIDPipe) id: string, @Param('photoId', ParseUUIDPipe) photoId: string) {
    return this.svc.setCover(id, photoId);
  }

  @Get('orders')
  @RequirePermissions('market.read')
  listOrders() {
    return this.svc.listOrders();
  }

  @Post('orders')
  @RequirePermissions('market.write')
  createOrder(@Body() dto: CreateOrderDto) {
    return this.svc.createOrder(dto);
  }

  @Patch('orders/:id/status')
  @RequirePermissions('market.write')
  updateOrderStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.svc.updateOrderStatus(id, dto);
  }

  @Post('orders/:id/paid')
  @RequirePermissions('market.write')
  markPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markPaid(id);
  }
}
