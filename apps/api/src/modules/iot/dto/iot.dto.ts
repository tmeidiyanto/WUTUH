import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateDeviceDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  code!: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  name!: string;

  @IsIn(['kelembapan_tanah', 'suhu_udara', 'kelembapan_udara', 'ph_tanah', 'level_air', 'curah_hujan'])
  deviceType!: string;

  @IsOptional() @IsUUID()
  landId?: string;

  @IsString() @IsNotEmpty() @MaxLength(10)
  unit!: string;

  @IsOptional() @IsNumberString()
  minThreshold?: string;

  @IsOptional() @IsNumberString()
  maxThreshold?: string;
}

export class UpdateDeviceDto {
  @IsOptional() @IsString() @MaxLength(80)
  name?: string;

  @IsOptional() @IsUUID()
  landId?: string;

  @IsOptional() @IsNumberString()
  minThreshold?: string;

  @IsOptional() @IsNumberString()
  maxThreshold?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

/** Payload dari perangkat di lapangan (tanpa JWT; autentikasi via apiKey). */
export class IngestDto {
  @IsString() @IsNotEmpty()
  apiKey!: string;

  @IsNumber()
  value!: number;
}
