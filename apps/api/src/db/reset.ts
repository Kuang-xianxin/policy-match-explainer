import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from './pool.js';
import { migrate } from './migrate.js';

async function assertResetAllowed(): Promise<void> {
  if (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test' || process.env.ALLOW_DB_RESET === 'true') return;
  const result = await pool.query('SELECT current_database() AS database_name, current_user AS user_name, inet_server_port() AS port');
  const current = result.rows[0] as { database_name: string; user_name: string; port: number };
  throw new Error(
    [
      `Refusing to reset database ${current.database_name} on port ${current.port} as ${current.user_name}.`,
      'Set ALLOW_DB_RESET=true only after confirming DATABASE_URL points to the project development database.'
    ].join(' ')
  );
}

export async function resetDatabase(): Promise<void> {
  await assertResetAllowed();
  await pool.query(`
    DROP TABLE IF EXISTS reports CASCADE;
    DROP TABLE IF EXISTS match_results CASCADE;
    DROP TABLE IF EXISTS match_runs CASCADE;
    DROP TABLE IF EXISTS policies CASCADE;
    DROP TABLE IF EXISTS source_documents CASCADE;
    DROP TABLE IF EXISTS enterprise_profiles CASCADE;
    DROP TABLE IF EXISTS company_lookup_records CASCADE;
    DROP TABLE IF EXISTS user_sessions CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  `);
  await migrate();
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
  resetDatabase()
    .then(async () => {
      console.log('Database reset.');
      await closePool();
    })
    .catch(async (error) => {
      console.error(error);
      await closePool();
      process.exit(1);
    });
}
