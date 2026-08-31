import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';

config({ path: '../../.env' });

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('Pemakaian: ts-node scripts/apply-sql.ts <file.sql> [file2.sql ...]');
    process.exit(1);
  }
  const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_ADMIN_URL / DATABASE_URL belum di-set');

  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const f of files) {
      const sql = readFileSync(resolve(process.cwd(), f), 'utf8');
      console.log(`-- Menjalankan ${f} ...`);
      await client.query(sql);
    }
    console.log('Selesai.');
  } finally {
    await client.end();
  }
}

void main();
