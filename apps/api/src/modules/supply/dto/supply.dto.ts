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

export class CreateWarehouseDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  code!: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  name!: string;

  @IsOptional() @IsString() @MaxLength(200)
  address?: string;

  @IsOptional() @IsNumberString()
  capacityKg?: string;
}

export class UpdateWarehouseDto {
  @IsOptional() @IsString() @MaxLength(80)
  name?: string;

  @IsOptional() @IsString() @MaxLength(200)
  address?: string;

  @IsOptional() @IsNumberString()
  capacityKg?: string;
}

export class AdjustStockDto {
  @IsUUID()
  warehouseId!: string;

  @IsUUID()
  commodityId!: string;

  @IsIn(['masuk', 'keluar'])
  direction!: 'masuk' | 'keluar';

  @IsNumberString()
  qty!: string;

  @IsString() @IsNotEmpty()
  unit!: string;

  @IsDateString()
  movementDate!: string;

  /** Siklus produksi asal — WAJIB saat direction 'masuk' (dicek di service). */
  @IsOptional() @IsUUID()
  cycleId?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class CreateDeliveryDto {
  @IsDateString()
  deliveryDate!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  origin!: string;

  @IsString() @IsNotEmpty() @MaxLength(120)
  destination!: string;

  @IsOptional() @IsUUID()
  commodityId?: string;

  @IsOptional() @IsNumberString()
  qty?: string;

  @IsOptional() @IsString() @MaxLength(20)
  unit?: string;

  @IsOptional() @IsString() @MaxLength(60)
  vehicle?: string;

  @IsOptional() @IsString() @MaxLength(80)
  driverName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  driverPhone?: string;

  @IsOptional() @IsNumberString()
  cost?: string;

  @IsOptional() @IsIn(['pesanan', 'ekspor', 'internal'])
  refType?: string;

  @IsOptional() @IsUUID()
  refId?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class UpdateDeliveryStatusDto {
  @IsIn(['dijadwalkan', 'dimuat', 'perjalanan', 'tiba', 'selesai'])
  status!: string;
}
