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

export class CreateCycleDto {
  @IsString() @IsNotEmpty() @MaxLength(80)
  name!: string;

  @IsIn(['tanaman', 'kebun', 'ternak'])
  category!: string;

  @IsUUID()
  commodityId!: string;

  @IsOptional() @IsUUID()
  landId?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional() @IsDateString()
  targetHarvestDate?: string;

  @IsOptional() @IsNumberString()
  areaHa?: string;

  @IsOptional() @IsNumberString()
  initialQty?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class UpdateCycleDto {
  @IsOptional() @IsString() @MaxLength(80)
  name?: string;

  @IsOptional() @IsUUID()
  landId?: string;

  @IsOptional() @IsDateString()
  targetHarvestDate?: string;

  @IsOptional() @IsNumberString()
  areaHa?: string;

  @IsOptional() @IsNumberString()
  initialQty?: string;

  @IsOptional() @IsIn(['berjalan', 'selesai', 'gagal'])
  status?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class AdvanceStageDto {
  /** Kosongkan untuk maju satu tahap; atau isi tahap tujuan (harus lebih maju). */
  @IsOptional() @IsString()
  toStage?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class CreateActivityDto {
  @IsDateString()
  activityDate!: string;

  @IsIn([
    'pengolahan', 'penyemaian', 'penanaman', 'pemupukan', 'penyiraman',
    'penyiangan', 'hama_penyakit', 'pakan', 'vitamin', 'lainnya',
  ])
  activityType!: string;

  @IsOptional() @IsString() @MaxLength(300)
  description?: string;

  @IsOptional() @IsNumberString()
  cost?: string;

  /** Foto bukti (data URL, sudah dikompres browser). */
  @IsOptional() @IsString() @MaxLength(8_000_000)
  photoDataUrl?: string;
}

export class CreateHarvestDto {
  @IsDateString()
  harvestDate!: string;

  @IsNumberString()
  qty!: string;

  @IsString() @IsNotEmpty()
  unit!: string;

  @IsOptional() @IsIn(['A', 'B', 'C'])
  quality?: string;

  /** Bila diisi, hasil panen otomatis masuk stok gudang ini. */
  @IsOptional() @IsUUID()
  warehouseId?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;

  /** Foto hasil panen (data URL, sudah dikompres browser). */
  @IsOptional() @IsString() @MaxLength(8_000_000)
  photoDataUrl?: string;
}
