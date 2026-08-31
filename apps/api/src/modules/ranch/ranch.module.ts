import { Module } from '@nestjs/common';
import { RanchController } from './ranch.controller';
import { RanchService } from './ranch.service';

@Module({
  controllers: [RanchController],
  providers: [RanchService],
})
export class RanchModule {}
