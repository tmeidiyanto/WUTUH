import { Module } from '@nestjs/common';
import { TrustModule } from '../trust/trust.module';
import { BazaarController } from './bazaar.controller';
import { BazaarService } from './bazaar.service';

@Module({
  imports: [TrustModule],
  controllers: [BazaarController],
  providers: [BazaarService],
})
export class BazaarModule {}
