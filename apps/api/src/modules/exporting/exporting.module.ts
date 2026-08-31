import { Module } from '@nestjs/common';
import { ExportingController } from './exporting.controller';
import { ExportingService } from './exporting.service';

@Module({
  controllers: [ExportingController],
  providers: [ExportingService],
})
export class ExportingModule {}
