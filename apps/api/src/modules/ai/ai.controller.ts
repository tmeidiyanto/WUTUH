import { Controller, Get, Headers } from '@nestjs/common';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { langFromHeader } from '../../shared/lang';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly svc: AiService) {}

  @Get('insights')
  @RequirePermissions('ai.read')
  insights(@Headers('accept-language') acceptLanguage?: string) {
    return this.svc.insights(langFromHeader(acceptLanguage));
  }
}
