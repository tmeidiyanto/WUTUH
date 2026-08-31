import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString() @IsNotEmpty() @MaxLength(80)
  fullName!: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsString() @MinLength(6)
  password!: string;

  @IsUUID()
  roleId!: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MaxLength(80)
  fullName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @IsOptional() @IsString() @MinLength(6)
  password?: string;

  @IsOptional() @IsUUID()
  roleId?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
