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

export class CreateLivestockDto {
  @IsString() @IsNotEmpty() @MaxLength(30)
  tag!: string;

  @IsUUID()
  commodityId!: string;

  @IsOptional() @IsUUID()
  landId?: string;

  @IsOptional() @IsUUID()
  cycleId?: string;

  @IsIn(['jantan', 'betina'])
  sex!: string;

  @IsOptional() @IsDateString()
  birthDate?: string;

  @IsOptional() @IsNumberString()
  weightKg?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class UpdateLivestockDto {
  @IsOptional() @IsUUID()
  landId?: string;

  @IsOptional() @IsNumberString()
  weightKg?: string;

  @IsOptional() @IsIn(['sehat', 'sakit', 'bunting', 'dijual', 'mati'])
  status?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class CreateProductionDto {
  @IsDateString()
  productionDate!: string;

  @IsOptional() @IsUUID()
  landId?: string;

  @IsOptional() @IsUUID()
  livestockId?: string;

  @IsUUID()
  commodityId!: string;

  @IsNumberString()
  qty!: string;

  @IsString() @IsNotEmpty()
  unit!: string;

  @IsOptional() @IsUUID()
  warehouseId?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class CreateHealthDto {
  @IsDateString()
  healthDate!: string;

  @IsUUID()
  livestockId!: string;

  @IsIn(['vaksinasi', 'pengobatan', 'pemeriksaan', 'vitamin'])
  action!: string;

  @IsOptional() @IsString() @MaxLength(120)
  medicine?: string;

  @IsOptional() @IsNumberString()
  cost?: string;

  @IsOptional() @IsDateString()
  nextDueDate?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}
