import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

const ACTIVITY_TYPES = [
  'pengolahan', 'penyemaian', 'penanaman', 'pemupukan', 'penyiraman',
  'penyiangan', 'hama_penyakit', 'pakan', 'vitamin', 'lainnya',
];

export class CreateAgendaDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  title!: string;

  @IsIn(ACTIVITY_TYPES)
  activityType!: string;

  @IsDateString()
  dueDate!: string;

  /** null/absen = sekali; N = ulangi tiap N hari setelah selesai. */
  @IsOptional() @IsInt() @Min(1) @Max(365)
  repeatDays?: number;

  /** Selesai → otomatis tercatat sebagai kegiatan siklus ini. */
  @IsOptional() @IsUUID()
  cycleId?: string;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class UpdateAgendaDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  title?: string;

  @IsOptional() @IsIn(ACTIVITY_TYPES)
  activityType?: string;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @IsOptional() @IsInt() @Min(1) @Max(365)
  repeatDays?: number | null;

  @IsOptional() @IsUUID()
  cycleId?: string | null;

  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}
