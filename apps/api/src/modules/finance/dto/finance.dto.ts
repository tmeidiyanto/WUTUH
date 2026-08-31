import { IsDateString, IsIn, IsNumberString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateTransactionDto {
  @IsDateString()
  txDate!: string;

  @IsIn(['masuk', 'keluar'])
  kind!: string;

  @IsIn([
    'penjualan', 'pembelian_input', 'tenaga_kerja', 'transportasi',
    'sewa', 'pakan', 'obat', 'alat', 'lainnya',
  ])
  category!: string;

  @IsNumberString()
  amount!: string;

  @IsOptional() @IsUUID()
  cycleId?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}
