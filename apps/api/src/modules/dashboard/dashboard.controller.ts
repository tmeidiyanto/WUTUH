import { Controller, Get, Headers } from '@nestjs/common';
import { langFromHeader } from '../../shared/lang';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly svc: DashboardService) {}

  @Get()
  overview(@Headers('accept-language') acceptLanguage?: string) {
    return this.svc.overview(langFromHeader(acceptLanguage));
  }
}
