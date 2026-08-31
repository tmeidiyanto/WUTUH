import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { I18nExceptionFilter } from './platform/http/i18n-exception.filter';
import { DatabaseModule } from './platform/db/database.module';
import { AuthModule } from './platform/auth/auth.module';
import { NumberingModule } from './platform/numbering/numbering.module';
import { JwtAuthGuard } from './platform/auth/jwt-auth.guard';
import { PermissionsGuard } from './platform/auth/permissions.decorator';
import { CompanyContextInterceptor } from './platform/auth/company-context.interceptor';
import { MasterModule } from './modules/master/master.module';
import { FarmModule } from './modules/farm/farm.module';
import { RanchModule } from './modules/ranch/ranch.module';
import { SupplyModule } from './modules/supply/supply.module';
import { MarketModule } from './modules/market/market.module';
import { TradeModule } from './modules/trade/trade.module';
import { ExportingModule } from './modules/exporting/exporting.module';
import { FinanceModule } from './modules/finance/finance.module';
import { AiModule } from './modules/ai/ai.module';
import { IotModule } from './modules/iot/iot.module';
import { IamModule } from './modules/iam/iam.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { BazaarModule } from './modules/bazaar/bazaar.module';
import { SettingsModule } from './modules/settings/settings.module';
import { PublicTraceModule } from './modules/publictrace/publictrace.module';
import { TrustModule } from './modules/trust/trust.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { WeatherModule } from './modules/weather/weather.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Satu sumber env: .env di root monorepo (cwd = apps/api saat dijalankan).
      envFilePath: ['../../.env', '.env'],
    }),
    DatabaseModule,
    AuthModule,
    NumberingModule,
    MasterModule,
    FarmModule,
    RanchModule,
    SupplyModule,
    MarketModule,
    TradeModule,
    ExportingModule,
    FinanceModule,
    AiModule,
    IotModule,
    IamModule,
    DashboardModule,
    BazaarModule,
    SettingsModule,
    PublicTraceModule,
    TrustModule,
    AgendaModule,
    WeatherModule,
  ],
  controllers: [HealthController],
  providers: [
    // Urutan penting: JwtAuthGuard dulu (set req.user), lalu PermissionsGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    // Interceptor berjalan setelah guard → membungkus handler dalam konteks company (ALS).
    { provide: APP_INTERCEPTOR, useClass: CompanyContextInterceptor },
    // Semua error dibalas dwibahasa (Accept-Language) dengan format seragam.
    { provide: APP_FILTER, useClass: I18nExceptionFilter },
  ],
})
export class AppModule {}
