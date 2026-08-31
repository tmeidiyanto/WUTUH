import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { DRIZZLE, PG_POOL, type DB } from './db.types';
import { UnitOfWork } from './unit-of-work';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.getOrThrow<string>('DATABASE_URL');
        return new Pool({ connectionString, max: 20 });
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): DB => drizzle(pool, { schema, casing: 'snake_case' }),
    },
    UnitOfWork,
  ],
  exports: [DRIZZLE, PG_POOL, UnitOfWork],
})
export class DatabaseModule {}
