import 'reflect-metadata';
import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module';
import type { ValidationItem } from './shared/errors';

/** Ratakan ValidationError (termasuk children) → daftar { property, constraints[] } untuk diterjemahkan filter. */
function flattenValidation(errors: ValidationError[], prefix = ''): ValidationItem[] {
  return errors.flatMap((e) => {
    const property = prefix ? `${prefix}.${e.property}` : e.property;
    const own: ValidationItem[] = e.constraints
      ? [{ property, constraints: Object.entries(e.constraints).map(([key, message]) => ({ key, message })) }]
      : [];
    return [...own, ...flattenValidation(e.children ?? [], property)];
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Foto produk dikirim sebagai data URL (JSON) → naikkan batas body.
  app.useBodyParser('json', { limit: '8mb' });

  // Sajikan foto produk secara statis (publik) di /uploads/...
  const uploadsDir = join(process.cwd(), 'uploads');
  mkdirSync(join(uploadsDir, 'listings'), { recursive: true });
  app.useStaticAssets(uploadsDir, { prefix: '/uploads/' });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      // Kirim error validasi ber-kunci; diterjemahkan oleh I18nExceptionFilter sesuai Accept-Language.
      exceptionFactory: (errors) => new BadRequestException({ key: 'validation', errors: flattenValidation(errors) }),
    }),
  );
  app.enableCors({
    origin: config.get<string>('CORS_ORIGIN', 'http://localhost:5174'),
    credentials: true,
  });

  const port = Number(config.get('API_PORT', 3001));
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`WUTUH API berjalan di http://localhost:${port}/api`);
}

void bootstrap();
