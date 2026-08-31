import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from './schema';

/** Instance Drizzle koneksi APP (RLS aktif). */
export type DB = NodePgDatabase<typeof schema>;

/** Tipe transaksi (tx) yang diberikan ke callback db.transaction(). */
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

/** Token DI untuk instance Drizzle app. */
export const DRIZZLE = Symbol('DRIZZLE');
/** Token DI untuk pg Pool app (kalau perlu akses mentah). */
export const PG_POOL = Symbol('PG_POOL');
