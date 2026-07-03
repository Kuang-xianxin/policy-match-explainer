import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closePool } from './pool.js';
import { migrate } from './migrate.js';

export async function resetDatabase(): Promise<void> {
  await pool.query(`
    DROP TABLE IF EXISTS reports CASCADE;
    DROP TABLE IF EXISTS match_results CASCADE;
    DROP TABLE IF EXISTS match_runs CASCADE;
    DROP TABLE IF EXISTS policies CASCADE;
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
