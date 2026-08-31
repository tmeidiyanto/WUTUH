import { Controller, Get } from '@nestjs/common';
import { Public } from './platform/auth/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { ok: true, app: 'WUTUH API', at: new Date().toISOString() };
  }
}
