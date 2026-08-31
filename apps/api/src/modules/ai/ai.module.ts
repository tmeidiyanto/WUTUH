import { Module } from '@nestjs/common';
import { WeatherModule } from '../weather/weather.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [WeatherModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
