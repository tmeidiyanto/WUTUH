import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePriceDto {
  @IsUUID()
  commodityId!: string;

  @IsString() @IsNotEmpty() @MaxLength(60)
  region!: string;

  @IsDateString()
  priceDate!: string;

  @IsNumberString()
  pricePerUnit!: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  unit!: string;

  @IsOptional() @IsString() @MaxLength(80)
  source?: string;
}

export class CreateListingDto {
  @IsUUID()
  commodityId!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  title!: string;

  @IsNumberString()
  qty!: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  unit!: string;

  @IsNumberString()
  pricePerUnit!: string;

  @IsOptional() @IsNumberString()
  minOrder?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  /** Siklus asal — pesanan Pasar WUTUH dari lapak ini otomatis tertaut ke siklus tsb. */
  @IsOptional() @IsUUID()
  cycleId?: string;
}

export class UpdateListingDto {
  @IsOptional() @IsString() @MaxLength(120)
  title?: string;

  @IsOptional() @IsNumberString()
  qty?: string;

  @IsOptional() @IsNumberString()
  pricePerUnit?: string;

  @IsOptional() @IsNumberString()
  minOrder?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsUUID()
  cycleId?: string;

  @IsOptional() @IsIn(['aktif', 'habis', 'nonaktif'])
  status?: string;
}

export class CreateOrderDto {
  @IsOptional() @IsUUID()
  listingId?: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  buyerName!: string;

  @IsOptional() @IsString() @MaxLength(30)
  buyerPhone?: string;

  @IsUUID()
  commodityId!: string;

  @IsNumberString()
  qty!: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  unit!: string;

  @IsNumberString()
  pricePerUnit!: string;

  @IsDateString()
  orderDate!: string;

  /** Gudang sumber barang (stok berkurang saat status 'dikirim'). */
  @IsOptional() @IsUUID()
  warehouseId?: string;

  /** Siklus asal hasil — pemasukan ditautkan ke siklus ini saat pesanan selesai. */
  @IsOptional() @IsUUID()
  cycleId?: string;

  @IsOptional() @IsIn(['qris', 'tunai'])
  paymentMethod?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

/** Foto produk sebagai data URL (dikompres di browser sebelum diunggah). */
export class UploadPhotoDto {
  @IsString() @IsNotEmpty() @MaxLength(8_000_000)
  dataUrl!: string;
}

export class UpdateOrderStatusDto {
  @IsIn(['baru', 'dikonfirmasi', 'dikirim', 'selesai', 'batal'])
  status!: string;
}
