import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreatePartnerDto {
  @IsString() @IsNotEmpty() @MaxLength(20)
  code!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  name!: string;

  @IsIn(['pembeli', 'pemasok', 'eksportir', 'koperasi', 'pengolah'])
  partnerType!: string;

  @IsOptional() @IsString() @MaxLength(80)
  contactName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(60)
  city?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class UpdatePartnerDto {
  @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @IsOptional() @IsIn(['pembeli', 'pemasok', 'eksportir', 'koperasi', 'pengolah'])
  partnerType?: string;

  @IsOptional() @IsString() @MaxLength(80)
  contactName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString() @MaxLength(60)
  city?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class CreateDealDto {
  @IsUUID()
  partnerId!: string;

  @IsUUID()
  commodityId!: string;

  @IsNumberString()
  qty!: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  unit!: string;

  @IsNumberString()
  pricePerUnit!: string;

  @IsOptional() @IsString() @MaxLength(120)
  deliveryTerms?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class UpdateDealDto {
  @IsOptional() @IsNumberString()
  qty?: string;

  @IsOptional() @IsNumberString()
  pricePerUnit?: string;

  @IsOptional() @IsString() @MaxLength(120)
  deliveryTerms?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsIn(['draf', 'negosiasi', 'kontrak', 'berjalan', 'selesai', 'batal'])
  status?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}
