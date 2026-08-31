import { IsOptional, IsString, Matches } from 'class-validator';

export class UpdateWeatherDto {
  /** Kode wilayah adm4 BMKG (cth. 34.04.07.2003); kosong = hapus. */
  @IsOptional() @IsString() @Matches(/^\d{2}\.\d{2}\.\d{2}\.\d{4}$/, { message: 'adm4' })
  adm4?: string;
}
