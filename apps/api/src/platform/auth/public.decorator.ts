import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Tandai endpoint yang boleh diakses tanpa JWT (login, register, health, iot ingest). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
