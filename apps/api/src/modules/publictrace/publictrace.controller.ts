import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../platform/auth/public.decorator';
import { PublicTraceService } from './publictrace.service';

/** Endpoint publik untuk halaman lacak (/lacak/:kode dari QR). */
@Public()
@Controller('public')
export class PublicTraceController {
  constructor(private readonly svc: PublicTraceService) {}

  @Get('trace/:code')
  byCode(@Param('code') code: string) {
    return this.svc.byCode(code);
  }
}
