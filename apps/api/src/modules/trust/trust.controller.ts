import { Controller, Get } from '@nestjs/common';
import { getContext } from '../../platform/tenancy/company-context';
import { TrustService } from './trust.service';

@Controller('trust')
export class TrustController {
  constructor(private readonly svc: TrustService) {}

  /** Skor usaha sendiri + rinciannya — ditampilkan di Beranda sebagai motivasi. */
  @Get('me')
  me() {
    return this.svc.compute(getContext().companyId);
  }
}
