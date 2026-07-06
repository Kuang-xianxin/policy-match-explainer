import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, pool } from './pool.js';
import { migrate } from './migrate.js';
import {
  collectLonghuaPolicies,
  defaultLonghuaPolicySources,
  upsertCollectedDocuments,
  type PolicySourceConfig
} from '../services/longhua-policy-collector.js';

function numberEnv(name: string): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function sourceOverrides(): PolicySourceConfig[] {
  const allPageLimit = numberEnv('LONGHUA_COLLECT_MAX_PAGES');
  const noticePageLimit = numberEnv('LONGHUA_COLLECT_NOTICE_MAX_PAGES');
  return defaultLonghuaPolicySources.map((source) => {
    if (source.name === 'announcements' && noticePageLimit) return { ...source, maxPages: noticePageLimit };
    if (allPageLimit) return { ...source, maxPages: allPageLimit };
    return source;
  });
}

async function run(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const delayMs = Number(process.env.LONGHUA_COLLECT_DELAY_MS ?? 200);
  const sources = sourceOverrides();
  await migrate();

  const collected = await collectLonghuaPolicies({
    sources,
    delayMs: Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 200
  });

  console.log(`Collected ${collected.documents.length} Longhua public policy documents.`);
  if (collected.errors.length > 0) {
    console.warn(`Collector warnings/errors: ${collected.errors.length}`);
    for (const error of collected.errors.slice(0, 20)) console.warn(`- ${error}`);
    if (collected.errors.length > 20) console.warn(`- ... ${collected.errors.length - 20} more`);
  }

  if (dryRun) {
    console.log('Dry run enabled; PostgreSQL was migrated but collected documents were not written.');
    return;
  }

  const stats = await upsertCollectedDocuments(pool, collected.documents);
  console.log(
    [
      `source_documents inserted=${stats.sourceDocumentsInserted}`,
      `updated=${stats.sourceDocumentsUpdated}`,
      `policies upserted=${stats.policiesUpserted}`,
      `non-matchable skipped=${stats.skippedPolicies}`,
      `generated rules demoted=${stats.policiesDemoted}`
    ].join(', ')
  );
}

if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1] ?? '')) {
  run()
    .then(async () => {
      await closePool();
    })
    .catch(async (error) => {
      console.error(error);
      await closePool();
      process.exit(1);
    });
}
