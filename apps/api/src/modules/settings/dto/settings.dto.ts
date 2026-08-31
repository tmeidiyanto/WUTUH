import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertChannelDto {
  @IsBoolean()
  isEnabled!: boolean;

  /** WA: { gatewayUrl, token } — token kosong/absen = pertahankan yang tersimpan. */
  @IsOptional() @IsObject()
  config?: Record<string, string>;

  @IsOptional() @IsArray() @IsIn(['order_status_to_buyer', 'new_order_to_seller', 'agenda_reminder'], { each: true })
  events?: string[];
}

export class TestChannelDto {
  /** Nomor tujuan pesan uji; kosong = No. HP profil usaha. */
  @IsOptional() @IsString() @MaxLength(30)
  target?: string;
}

export class UpdatePaymentDto {
  /** Gambar QRIS sebagai data URL (dikompres di browser); absen = tidak diubah. */
  @IsOptional() @IsString() @MaxLength(8_000_000)
  qrisDataUrl?: string;

  /** true = hapus QRIS tersimpan. */
  @IsOptional() @IsBoolean()
  removeQris?: boolean;
}
