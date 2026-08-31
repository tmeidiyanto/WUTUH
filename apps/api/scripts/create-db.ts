import { config } from 'dotenv';
import { Client } from 'pg';

config({ path: '../../.env' });

/** Buat database 'wutuh' bila belum ada (koneksi admin ke db 'postgres'). */
async function main() {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  if (!adminUrl) throw new Error('DATABASE_ADMIN_URL belum di-set');

  const url = new URL(adminUrl);
  const dbName = url.pathname.replace(/^\//, '') || 'wutuh';
  url.pathname = '/postgres';

  const client = new Client({ connectionString: url.toString() });
  await client.connect();
  try {
    const { rows } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (rows.length) {
      console.log(`Database '${dbName}' sudah ada.`);
    } else {
      await client.query(`CREATE DATABASE ${JSON.stringify(dbName).replace(/"/g, '"')}`);
      console.log(`Database '${dbName}' dibuat.`);
    }
  } finally {
    await client.end();
  }
}

void main();
