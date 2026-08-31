import { BadRequestException, Body, Controller, Get, Put } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Inject } from '@nestjs/common';
import { DRIZZLE, type DB } from '../../platform/db/db.types';
import { companies } from '../../platform/db/schema';
import { RequirePermissions } from '../../platform/auth/permissions.decorator';
import { getContext } from '../../platform/tenancy/company-context';
import { msg } from '../../shared/errors';
import { WeatherService } from './weather.service';
import { UpdateWeatherDto } from './dto/weather.dto';

@Controller('weather')
export class WeatherController {
  constructor(
    private readonly svc: WeatherService,
    @Inject(DRIZZLE) private readonly db: DB,
  ) {}

  /** Prakiraan cuaca lokasi usaha (BMKG) + saran WUTUH AI. */
  @Get()
  forecast() {
    return this.svc.forecastFor(getContext().companyId);
  }

  /** Setel/hapus kode wilayah BMKG (adm4). Kode divalidasi langsung ke BMKG. */
  @Put('location')
  @RequirePermissions('settings.write')
  async setLocation(@Body() dto: UpdateWeatherDto) {
    const companyId = getContext().companyId;
    const adm4 = dto.adm4?.trim() || null;

    let location = null;
    if (adm4) {
      location = await this.svc.probe(adm4);
      if (!location) throw new BadRequestException(msg('weather.badCode'));
    }
    await this.db.update(companies).set({ weatherCode: adm4, updatedAt: new Date() }).where(eq(companies.id, companyId));
    return { weatherCode: adm4, location };
  }
}
