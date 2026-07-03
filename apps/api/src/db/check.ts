import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { pool, closePool } from './pool.js';

function redactDatabaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return '<invalid DATABASE_URL>';
  }
}

export async function checkDatabase(): Promise<void> {
  const started = Date.now();
  await pool.query('SELECT 1');
  const elapsedMs = Date.now() - started;
  console.log(`Database connection ok: ${redactDatabaseUrl(env.databaseUrl)} (${elapsedMs}ms)`);
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
  checkDatabase()
    .then(async () => {
      await closePool();
    })
    .catch(async (error: unknown) => {
      const dbError = error as { code?: string; message?: string };
      console.error(`Database connection failed: ${redactDatabaseUrl(env.databaseUrl)}`);
      console.error(`Reason: ${dbError.code ?? 'UNKNOWN'} ${dbError.message ?? String(error)}`);
      console.error('Hint: run `npm run db:up`, then `npm run db:migrate` and `npm run db:seed`.');
      await closePool();
      process.exit(1);
    });
}
