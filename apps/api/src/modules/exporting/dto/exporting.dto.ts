import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateShipmentDto {
  @IsUUID()
  commodityId!: string;

  @IsString() @IsNotEmpty() @MaxLength(60)
  destinationCountry!: string;

  @IsOptional() @IsString() @MaxLength(60)
  destinationPort?: string;

  @IsOptional() @IsString() @MaxLength(100)
  buyerName?: string;

  @IsNumberString()
  qty!: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  unit!: string;

  @IsNumberString()
  valueAmount!: string;

  @IsIn(['USD', 'IDR', 'EUR', 'JPY', 'SGD', 'CNY'])
  currency!: string;

  @IsOptional() @IsDateString()
  etd?: string;

  @IsOptional() @IsDateString()
  eta?: string;

  /** Gudang sumber — stok keluar saat status 'pengapalan'. */
  @IsOptional() @IsUUID()
  warehouseId?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class UpdateShipmentDto {
  @IsOptional() @IsIn(['persiapan', 'dokumen', 'pengapalan', 'tiba', 'selesai'])
  status?: string;

  @IsOptional() @IsObject()
  docs?: {
    invoice: boolean;
    packingList: boolean;
    coo: boolean;
    phytosanitary: boolean;
    billOfLading: boolean;
  };

  @IsOptional() @IsDateString()
  etd?: string;

  @IsOptional() @IsDateString()
  eta?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}
