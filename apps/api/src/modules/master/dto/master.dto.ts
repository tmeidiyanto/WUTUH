import { IsBoolean, IsIn, IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateLandDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  code!: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  name!: string;

  @IsIn(['sawah', 'ladang', 'kebun', 'kandang', 'tambak', 'pekarangan'])
  landUse!: string;

  @IsNumberString()
  areaHa!: string;

  @IsOptional() @IsString() @MaxLength(80)
  village?: string;

  @IsOptional() @IsString() @MaxLength(40)
  soilType?: string;

  @IsOptional() @IsString() @MaxLength(40)
  irrigation?: string;
}

export class UpdateLandDto {
  @IsOptional() @IsString() @MaxLength(80)
  name?: string;

  @IsOptional() @IsIn(['sawah', 'ladang', 'kebun', 'kandang', 'tambak', 'pekarangan'])
  landUse?: string;

  @IsOptional() @IsNumberString()
  areaHa?: string;

  @IsOptional() @IsString() @MaxLength(80)
  village?: string;

  @IsOptional() @IsString() @MaxLength(40)
  soilType?: string;

  @IsOptional() @IsString() @MaxLength(40)
  irrigation?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateCommodityDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  code!: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  name!: string;

  @IsIn(['pangan', 'hortikultura', 'perkebunan', 'ternak', 'perikanan', 'olahan'])
  category!: string;

  @IsIn(['kg', 'ton', 'ekor', 'liter', 'butir', 'ikat', 'karung'])
  unit!: string;

  @IsOptional() @IsNumberString()
  avgYieldPerHa?: string;
}

export class UpdateCommodityDto {
  @IsOptional() @IsString() @MaxLength(80)
  name?: string;

  @IsOptional() @IsIn(['pangan', 'hortikultura', 'perkebunan', 'ternak', 'perikanan', 'olahan'])
  category?: string;

  @IsOptional() @IsIn(['kg', 'ton', 'ekor', 'liter', 'butir', 'ikat', 'karung'])
  unit?: string;

  @IsOptional() @IsNumberString()
  avgYieldPerHa?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
