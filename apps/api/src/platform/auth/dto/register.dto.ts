import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Registrasi mandiri usaha tani baru (self-service onboarding). */
export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  businessName!: string;

  @IsIn(['petani', 'kelompok_tani', 'koperasi', 'perusahaan'])
  businessType!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  fullName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  regency?: string;
}
