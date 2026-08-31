import { Module } from '@nestjs/common';
import { TrustModule } from '../trust/trust.module';
import { PublicTraceController } from './publictrace.controller';
import { PublicTraceService } from './publictrace.service';

@Module({
  imports: [TrustModule],
  controllers: [PublicTraceController],
  providers: [PublicTraceService],
})
export class PublicTraceModule {}
