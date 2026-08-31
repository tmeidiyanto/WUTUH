import { IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class BazaarQueryDto {
  @IsOptional() @IsString() @MaxLength(80)
  search?: string;

  @IsOptional() @IsIn(['pangan', 'hortikultura', 'perkebunan', 'ternak', 'perikanan', 'olahan'])
  category?: string;

  @IsOptional() @IsIn(['terbaru', 'termurah', 'termahal'])
  sort?: string;
}

/** Checkout Pasar WUTUH — publik, tanpa login. */
export class CreateBazaarOrderDto {
  @IsUUID()
  listingId!: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  buyerName!: string;

  @IsString() @IsNotEmpty() @MaxLength(30)
  buyerPhone!: string;

  @IsNumberString()
  qty!: string;

  /** qris hanya bisa dipilih bila penjual sudah mengunggah QRIS. */
  @IsOptional() @IsIn(['qris', 'tunai'])
  paymentMethod?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}
